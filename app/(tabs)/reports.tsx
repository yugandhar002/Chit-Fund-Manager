import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Dimensions, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Badge, Card, EmptyState } from '../../src/components/ui';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { AuctionRepository, Chit, ChitRepository, MemberRepository, PaymentRepository } from '../../src/database';

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [winners, setWinners] = useState<number[]>([]);
  const [outstanding, setOutstanding] = useState<{ member_id: number, member_name: string, total_due: number, total_overpaid: number, net_due: number }[]>([]);
  const [commissionHistory, setCommissionHistory] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');

  // Interactive Analytics State
  const [selectedDonutSector, setSelectedDonutSector] = useState<'won' | 'pending' | null>(null);
  const [selectedMonthBar, setSelectedMonthBar] = useState<number | null>(null);
  const [selectedMemberDuesId, setSelectedMemberDuesId] = useState<number | null>(null);

  const groupedHistory = commissionHistory.reduce((acc, item) => {
    if (!acc[item.month_number]) acc[item.month_number] = [];
    acc[item.month_number].push(item);
    return acc;
  }, {} as any);

  const loadData = useCallback(async () => {
    try {
      const chitRepo = new ChitRepository();
      const auctionRepo = new AuctionRepository();
      const paymentRepo = new PaymentRepository();
      const memberRepo = new MemberRepository();

      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);

      if (chit) {
        const [winnerList, dueList, history, allMembers] = await Promise.all([
          auctionRepo.getWinners(chit.id),
          paymentRepo.getOutstandingDuesByMember(chit.id),
          auctionRepo.getAuctionHistory(chit.id),
          memberRepo.getMembersByChit(chit.id)
        ]);

        setWinners(winnerList);
        setOutstanding(dueList);
        setCommissionHistory(history);
        setMembers(allMembers);

        // Pre-select latest auction in bar chart
        if (history && history.length > 0) {
          setSelectedMonthBar(history[history.length - 1].month_number);
        }
      }
    } catch (e) {
      console.log('DB not setup or empty:', (e as any)?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const shareAuctionReceipt = useCallback((item: any) => {
    if (!activeChit || !item || !item.winner_phone) return;

    const winnerName = item.winner_name;
    const chitName = activeChit.name;
    const auctionNum = item.auction_number || '1';
    const chitValStr = (activeChit.total_value / 100).toLocaleString();
    const commStr = (item.commission_amount / 100).toLocaleString();
    const payoutStr = (item.payout_amount / 100).toLocaleString();

    const message = `*${chitName} — Auction Receipt* \n` +
      `-----------------------------------------\n` +
      `Hello *${winnerName}*! \n` +
      `Congratulations on winning the auction! 🎉\n\n` +
      `Here are your auction details:\n` +
      `• *Auction Number:* ${auctionNum}\n` +
      `• *Total Chit Value:* ₹${chitValStr}\n` +
      `• *Bid Amount:* ₹${commStr}\n` +
      `• *Net Payout Amount:* *₹${payoutStr}*\n\n` +
      `The net amount of *₹${payoutStr}* will be disbursed to you shortly.\n\n` +
      `Thank you! Best regards. 🙏\n` +
      `-----------------------------------------`;

    let formattedPhone = item.winner_phone.trim();
    formattedPhone = formattedPhone.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open WhatsApp:', err);
      Alert.alert('Error', 'Could not open WhatsApp. Please check if the app is installed.');
    });
  }, [activeChit]);

  // Outstanding Dues WhatsApp Reminders
  const handleDuesAction = (item: any, type: 'call' | 'whatsapp') => {
    const memberRecord = members.find(m => m.id === item.member_id);
    if (!memberRecord || !memberRecord.phone) {
      Alert.alert('Contact Error', 'This member does not have a phone number registered.');
      return;
    }

    let cleanPhone = memberRecord.phone.trim().replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    if (type === 'call') {
      Linking.openURL(`tel:${cleanPhone}`).catch(err => {
        Alert.alert('Error', 'Could not initiate call. Please verify device phone support.');
      });
    } else {
      let message = '';
      if (item.net_due > 0) {
        message = `*Payment Reminder — ${activeChit?.name || 'Chit Fund'}* \n` +
          `-----------------------------------------\n` +
          `Hello *${item.member_name}*, \n` +
          `This is a friendly reminder that you have pending dues of *₹${(item.net_due / 100).toLocaleString()}* for the current round.\n\n` +
          `Please clear the payment at your earliest convenience.\n\n` +
          `Thank you! 🙏`;
      } else {
        message = `*Refund Update — ${activeChit?.name || 'Chit Fund'}* \n` +
          `-----------------------------------------\n` +
          `Hello *${item.member_name}*, \n` +
          `This is a status update that you have an overpayment credit of *₹${(Math.abs(item.net_due) / 100).toLocaleString()}* scheduled to be refunded.\n\n` +
          `Thank you! 🙏`;
      }

      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      Linking.openURL(url).catch((err) => {
        Alert.alert('Error', 'Could not open WhatsApp.');
      });
    }
  };

  if (loading && outstanding.length === 0 && !activeChit) return <View style={styles.container} />;

  if (!activeChit) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="bar-chart-outline"
          title="No Data Available"
          message="Reports will be generated once the chit fund is active."
        />
      </View>
    );
  }

  // --- ANALYTICS CALCULATIONS ---
  const totalMembersCount = members.length;
  const wonMembersCount = winners.length;
  const pendingMembersCount = Math.max(0, totalMembersCount - wonMembersCount);
  const wonPercentage = totalMembersCount > 0 ? (wonMembersCount / totalMembersCount) : 0;

  // Donut SVG settings
  const donutRadius = 36;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutStrokeDashoffset = donutCircumference - (wonPercentage * donutCircumference);

  // Bar Chart SVG settings
  const chartHeight = 160;
  const chartWidth = Dimensions.get('window').width - 48; // screen padding
  const chartPaddingTop = 20;
  const chartPaddingBottom = 20;
  const chartPaddingLeft = 45;
  const chartPaddingRight = 10;
  const plotHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const plotWidth = chartWidth - chartPaddingLeft - chartPaddingRight;

  const maxCommissionVal = commissionHistory.length > 0
    ? Math.max(...commissionHistory.map(h => h.commission_amount), 10000 * 100)
    : 10000 * 100;

  const selectedMonthAuction = commissionHistory.find(h => h.month_number === selectedMonthBar);

  const maxAbsoluteDue = outstanding.length > 0
    ? Math.max(...outstanding.map(d => Math.abs(d.net_due)), 1)
    : 1;

  return (
    <View style={styles.container}>
      {/* Top Segment Tab Toggle */}
      <View style={styles.tabWrapper}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'list' && styles.activeTabButton]}
            onPress={() => setActiveTab('list')}
            activeOpacity={0.7}
          >
            <Ionicons name="list-outline" size={16} color={activeTab === 'list' ? Colors.textPrimary : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>Summary List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'analytics' && styles.activeTabButton]}
            onPress={() => setActiveTab('analytics')}
            activeOpacity={0.7}
          >
            <Ionicons name="pie-chart-outline" size={16} color={activeTab === 'analytics' ? Colors.textPrimary : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>Visual Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
        {activeTab === 'list' ? (
          /* --- SUMMARY LIST VIEW --- */
          <>
            <Text style={styles.sectionTitle}>Settlement Status (Pot Winners)</Text>
            <Card style={styles.reportCard}>
              <View style={styles.settlementGrid}>
                {members.map(member => {
                  const hasWon = winners.includes(member.id);
                  return (
                    <View key={member.id} style={styles.memberStatusItem}>
                      <View style={[styles.statusDot, { backgroundColor: hasWon ? Colors.success : Colors.border }]} />
                      <Text style={[styles.memberStatusName, { color: hasWon ? Colors.textPrimary : Colors.textSecondary }]} numberOfLines={1}>
                        {member.name}
                      </Text>
                      {hasWon && <Badge label="WON" variant="success" style={styles.miniBadge} />}
                    </View>
                  );
                })}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.legendText}>Won Pot</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.statusDot, { backgroundColor: Colors.border }]} />
                  <Text style={styles.legendText}>Pending</Text>
                </View>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>Outstanding Dues Summary</Text>
            <Card style={styles.reportCard}>
              {outstanding.length > 0 ? (
                outstanding.map((item, index) => {
                  const hasBreakdown = item.total_due > 0 && item.total_overpaid > 0;
                  return (
                    <View key={item.member_id} style={[
                      styles.simpleDueRow,
                      index !== outstanding.length - 1 && styles.borderBottom
                    ]}>
                      <View style={styles.dueInfoCol}>
                        <Text style={styles.dueMemberName}>{item.member_name}</Text>
                        {hasBreakdown && (
                          <Text style={styles.dueSubText}>
                            Due: ₹{(item.total_due / 100).toLocaleString()} | Refund: ₹{(item.total_overpaid / 100).toLocaleString()}
                          </Text>
                        )}
                      </View>

                      <View style={styles.dueAmountCol}>
                        <Text style={[
                          styles.netAmountLabel,
                          { color: item.net_due > 0 ? Colors.error : Colors.warning }
                        ]}>
                          {item.net_due > 0 ? 'OWES' : 'TO BE REFUNDED'}
                        </Text>
                        <Text style={[
                          styles.netAmountValueSimple,
                          { color: item.net_due > 0 ? Colors.error : Colors.warning }
                        ]}>
                          ₹{(Math.abs(item.net_due) / 100).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>All members have cleared their dues!</Text>
              )}
            </Card>

            <Text style={styles.sectionTitle}>Commission History</Text>
            <Card style={styles.historyCard}>
              {Object.keys(groupedHistory).reverse().map((month) => (
                <View key={month} style={styles.monthGroup}>
                  <View style={styles.monthHeader}>
                    <Text style={styles.historyMonthLabel}>Month {month}</Text>
                    <Text style={styles.monthTotal}>
                      Total: ₹{(groupedHistory[month].reduce((sum: number, item: any) => sum + item.commission_amount, 0) / 100).toLocaleString()}
                    </Text>
                  </View>
                  {groupedHistory[month].map((item: any, index: number) => (
                    <View key={`${item.id}-${index}`} style={styles.historyRow}>
                      <View style={styles.winnerInfo}>
                        <Text style={styles.historyWinner}>Winner: {item.winner_name}</Text>
                        {groupedHistory[month].length > 1 && (
                          <Badge label={`Pata ${item.auction_number}`} variant="info" style={styles.miniBadge} />
                        )}
                      </View>
                      <View style={styles.historyRightCol}>
                        <Text style={styles.historyComm}>₹{(item.commission_amount / 100).toLocaleString()}</Text>
                        {item.winner_phone ? (
                          <TouchableOpacity
                            onPress={() => shareAuctionReceipt(item)}
                            style={styles.shareIconBtn}
                          >
                            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
              {commissionHistory.length === 0 && (
                <Text style={styles.emptyText}>No auctions recorded yet.</Text>
              )}
            </Card>
          </>
        ) : (
          /* --- INTERACTIVE ANALYTICS & GRAPH VIEW --- */
          <>
            {/* Donut Progress Chart Card */}
            <Text style={styles.sectionTitle}>Pot Winner Progress</Text>
            <Card style={styles.donutCard}>
              <View style={styles.donutContainer}>
                <View style={styles.donutSvgWrapper}>
                  <Svg width={140} height={140} viewBox="0 0 100 100">
                    {/* Background Ring (Pending) */}
                    <Circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      stroke={selectedDonutSector === 'pending' ? Colors.info : Colors.border}
                      strokeWidth={11}
                      fill="transparent"
                      onPress={() => setSelectedDonutSector(selectedDonutSector === 'pending' ? null : 'pending')}
                    />
                    {/* Foreground Ring (Won) */}
                    {wonMembersCount > 0 && (
                      <Circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke={selectedDonutSector === 'won' ? '#eab308' : Colors.success}
                        strokeWidth={11}
                        fill="transparent"
                        strokeDasharray={donutCircumference}
                        strokeDashoffset={donutStrokeDashoffset}
                        strokeLinecap="round"
                        rotation="-90"
                        origin="50, 50"
                        onPress={() => setSelectedDonutSector(selectedDonutSector === 'won' ? null : 'won')}
                      />
                    )}

                    {/* Center details */}
                    <G>
                      <SvgText
                        x="50"
                        y="46"
                        textAnchor="middle"
                        fill={Colors.textPrimary}
                        fontSize="13"
                        fontWeight="bold"
                      >
                        {selectedDonutSector === 'won'
                          ? `${wonMembersCount}`
                          : selectedDonutSector === 'pending'
                            ? `${pendingMembersCount}`
                            : `${totalMembersCount}`}
                      </SvgText>
                      <SvgText
                        x="50"
                        y="62"
                        textAnchor="middle"
                        fill={Colors.textSecondary}
                        fontSize="7"
                        fontWeight="bold"
                      >
                        {selectedDonutSector === 'won'
                          ? 'WON POT'
                          : selectedDonutSector === 'pending'
                            ? 'PENDING'
                            : 'MEMBERS'}
                      </SvgText>
                    </G>
                  </Svg>
                </View>

                {/* Donut Interactive Legend */}
                <View style={styles.donutLegendContainer}>
                  <TouchableOpacity
                    style={[
                      styles.legendButton,
                      selectedDonutSector === 'won' && { backgroundColor: Colors.success + '15', borderColor: Colors.success }
                    ]}
                    onPress={() => setSelectedDonutSector(selectedDonutSector === 'won' ? null : 'won')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.legendIndicator, { backgroundColor: Colors.success }]} />
                    <Text style={styles.legendLabelText}>Won Pot</Text>
                    <Text style={styles.legendValText}>{wonMembersCount} ({Math.round(wonPercentage * 100)}%)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.legendButton,
                      selectedDonutSector === 'pending' && { backgroundColor: Colors.info + '15', borderColor: Colors.info }
                    ]}
                    onPress={() => setSelectedDonutSector(selectedDonutSector === 'pending' ? null : 'pending')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.legendIndicator, { backgroundColor: Colors.border }]} />
                    <Text style={styles.legendLabelText}>Pending</Text>
                    <Text style={styles.legendValText}>{pendingMembersCount} ({Math.round((1 - wonPercentage) * 100)}%)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Show list corresponding to selected sector below donut */}
              {selectedDonutSector && (
                <View style={styles.donutDetailSection}>
                  <View style={styles.donutDetailHeader}>
                    <Text style={styles.donutDetailTitle}>
                      {selectedDonutSector === 'won' ? '🏆 Won Pot Members' : '⏳ Pending / Eligible Bidders'}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedDonutSector(null)}>
                      <Text style={styles.clearLinkText}>Clear filter</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.donutDetailList}>
                    {members
                      .filter(m => (selectedDonutSector === 'won' ? winners.includes(m.id) : !winners.includes(m.id)))
                      .map((m, index) => (
                        <View key={m.id} style={styles.donutDetailItem}>
                          <Text style={styles.donutDetailText}>
                            {index + 1}. {m.name}
                          </Text>
                          {selectedDonutSector === 'won' ? (
                            <Badge label="WON" variant="success" />
                          ) : (
                            <Badge label="ELIGIBLE" variant="info" />
                          )}
                        </View>
                      ))}
                  </View>
                </View>
              )}
            </Card>

            {/* Auction Bid & Commission Bar Chart */}
            <Text style={styles.sectionTitle}>Monthly Bid & Commission Trend</Text>
            <Card style={styles.barChartCard}>
              {commissionHistory.length > 0 ? (
                <>
                  <Text style={styles.chartInstructionText}>Tap a month's bar to view auction details</Text>
                  <View style={styles.chartWrapper}>
                    <Svg width={chartWidth} height={chartHeight}>
                      {/* Grid Lines */}
                      <Line
                        x1={chartPaddingLeft}
                        y1={chartPaddingTop}
                        x2={chartWidth - chartPaddingRight}
                        y2={chartPaddingTop}
                        stroke={Colors.border}
                        strokeDasharray="4 4"
                      />
                      <Line
                        x1={chartPaddingLeft}
                        y1={chartPaddingTop + plotHeight / 2}
                        x2={chartWidth - chartPaddingRight}
                        y2={chartPaddingTop + plotHeight / 2}
                        stroke={Colors.border}
                        strokeDasharray="4 4"
                      />
                      <Line
                        x1={chartPaddingLeft}
                        y1={chartPaddingTop + plotHeight}
                        x2={chartWidth - chartPaddingRight}
                        y2={chartPaddingTop + plotHeight}
                        stroke={Colors.border}
                      />

                      {/* Y-axis Labels */}
                      <SvgText
                        x={chartPaddingLeft - 8}
                        y={chartPaddingTop + 4}
                        textAnchor="end"
                        fill={Colors.textSecondary}
                        fontSize="9"
                        fontWeight="600"
                      >
                        {`₹${Math.round(maxCommissionVal / 100 / 1000)}k`}
                      </SvgText>
                      <SvgText
                        x={chartPaddingLeft - 8}
                        y={chartPaddingTop + plotHeight / 2 + 4}
                        textAnchor="end"
                        fill={Colors.textSecondary}
                        fontSize="9"
                        fontWeight="600"
                      >
                        {`₹${Math.round((maxCommissionVal / 2) / 100 / 1000)}k`}
                      </SvgText>
                      <SvgText
                        x={chartPaddingLeft - 8}
                        y={chartPaddingTop + plotHeight + 4}
                        textAnchor="end"
                        fill={Colors.textSecondary}
                        fontSize="9"
                        fontWeight="600"
                      >
                        ₹0
                      </SvgText>

                      {/* Rendering Bars */}
                      {commissionHistory.map((item, index) => {
                        const slotWidth = plotWidth / commissionHistory.length;
                        const centerX = chartPaddingLeft + (index * slotWidth) + (slotWidth / 2);

                        const barWidth = Math.min(22, slotWidth * 0.5);
                        const rawBarHeight = (item.commission_amount / maxCommissionVal) * plotHeight;
                        const barHeight = Math.max(8, rawBarHeight); // minimum height so it is visible & clickable
                        const barY = chartPaddingTop + plotHeight - barHeight;
                        const barX = centerX - (barWidth / 2);

                        const isSelected = selectedMonthBar === item.month_number;

                        return (
                          <G key={item.id}>
                            {/* Bar Rect */}
                            <Rect
                              x={barX}
                              y={barY}
                              width={barWidth}
                              height={barHeight}
                              rx={4}
                              ry={4}
                              fill={isSelected ? Colors.secondary : Colors.info}
                              opacity={selectedMonthBar === null || isSelected ? 1 : 0.45}
                              onPress={() => setSelectedMonthBar(item.month_number)}
                            />
                            {/* X-axis Label */}
                            <SvgText
                              x={centerX}
                              y={chartPaddingTop + plotHeight + 14}
                              textAnchor="middle"
                              fill={isSelected ? Colors.secondary : Colors.textSecondary}
                              fontSize="9"
                              fontWeight="bold"
                            >
                              {`M${item.month_number}`}
                            </SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                  </View>

                  {/* Selected Month Auction Details Card */}
                  {selectedMonthAuction && (
                    <View style={styles.chartDetailsCard}>
                      <View style={styles.chartDetailsHeader}>
                        <Text style={styles.chartDetailsTitle}>Month {selectedMonthAuction.month_number} Auction Result</Text>
                        {selectedMonthAuction.winner_phone ? (
                          <TouchableOpacity
                            onPress={() => shareAuctionReceipt(selectedMonthAuction)}
                            style={styles.shareBtnPill}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                            <Text style={styles.shareBtnPillText}>Receipt</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <View style={styles.detailCardRow}>
                        <Text style={styles.detailCardLabel}>Winner Name</Text>
                        <Text style={[styles.detailCardVal, { color: Colors.secondary }]}>
                          {selectedMonthAuction.winner_name}
                        </Text>
                      </View>
                      <View style={styles.detailCardRow}>
                        <Text style={styles.detailCardLabel}>Highest Bid (Commission)</Text>
                        <Text style={styles.detailCardVal}>
                          ₹{(selectedMonthAuction.commission_amount / 100).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.detailCardRow}>
                        <Text style={styles.detailCardLabel}>Net Cash Payout</Text>
                        <Text style={[styles.detailCardVal, { color: Colors.success }]}>
                          ₹{(selectedMonthAuction.payout_amount / 100).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.detailCardRow}>
                        <Text style={styles.detailCardLabel}>Dividend distributed</Text>
                        <Text style={styles.detailCardVal}>
                          ₹{(selectedMonthAuction.dividend_per_member / 100).toLocaleString()} per member
                        </Text>
                      </View>
                      <View style={styles.detailCardRow}>
                        <Text style={styles.detailCardLabel}>Actual Contribution Due</Text>
                        <Text style={styles.detailCardVal}>
                          ₹{(selectedMonthAuction.effective_contribution / 100).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>Record auctions to view charts & trend graphs.</Text>
              )}
            </Card>

            {/* Visual Outstanding Dues list */}
            <Text style={styles.sectionTitle}>Member Balances (Interactive List)</Text>
            <Card style={styles.reportCard}>
              <Text style={styles.chartInstructionText}>Tap a member for instant dial/reminder shortcuts</Text>
              {outstanding.length > 0 ? (
                outstanding.map((item) => {
                  const absoluteDue = Math.abs(item.net_due);
                  const progressRatio = maxAbsoluteDue > 0 ? (absoluteDue / maxAbsoluteDue) : 0;
                  const isOwes = item.net_due > 0;
                  const isSelected = selectedMemberDuesId === item.member_id;

                  return (
                    <View key={item.member_id} style={styles.visualDueRowContainer}>
                      <TouchableOpacity
                        style={[
                          styles.visualDueRow,
                          isSelected && styles.visualDueRowSelected
                        ]}
                        onPress={() => setSelectedMemberDuesId(isSelected ? null : item.member_id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.dueMemberMeta}>
                          <Text style={styles.visualDueMemberName}>{item.member_name}</Text>
                          <Text style={[
                            styles.visualDueAmtText,
                            { color: isOwes ? Colors.error : Colors.warning }
                          ]}>
                            {isOwes ? 'Owes' : 'Overpaid'} ₹{(absoluteDue / 100).toLocaleString()}
                          </Text>
                        </View>

                        {/* Custom visual progress bar */}
                        <View style={styles.progressBarWrapper}>
                          <View style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.round(progressRatio * 100)}%`,
                              backgroundColor: isOwes ? Colors.error : Colors.warning
                            }
                          ]} />
                        </View>
                      </TouchableOpacity>

                      {/* Expandable Member Actions Sheet */}
                      {isSelected && (
                        <View style={styles.memberActionSheet}>
                          <Text style={styles.actionSheetLabel}>Quick Actions for {item.member_name}:</Text>
                          <View style={styles.actionSheetButtons}>
                            <TouchableOpacity
                              style={[styles.sheetBtn, styles.callSheetBtn]}
                              onPress={() => handleDuesAction(item, 'call')}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="call-outline" size={16} color="#ffffff" />
                              <Text style={styles.sheetBtnText}>Call</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sheetBtn, styles.whatsappSheetBtn]}
                              onPress={() => handleDuesAction(item, 'whatsapp')}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="logo-whatsapp" size={16} color="#ffffff" />
                              <Text style={styles.sheetBtnText}>Reminder</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sheetBtn, styles.statementSheetBtn]}
                              onPress={() => router.push({ pathname: '/member-statement', params: { memberId: item.member_id.toString() } })}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="document-text-outline" size={16} color="#ffffff" />
                              <Text style={styles.sheetBtnText}>Ledger</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>All balances cleared! No outstanding dues.</Text>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: 110,
  },
  tabWrapper: {
    backgroundColor: Colors.primary,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: Colors.textPrimary,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
    letterSpacing: 0.5,
  },
  reportCard: {
    padding: Theme.spacing.md,
  },
  settlementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  memberStatusItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    backgroundColor: Colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  memberStatusName: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  miniBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  legend: {
    flexDirection: 'row',
    marginTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Theme.spacing.lg,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  simpleDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dueInfoCol: {
    flex: 1,
  },
  dueMemberName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  dueSubText: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  dueAmountCol: {
    alignItems: 'flex-end',
  },
  netAmountLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  netAmountValueSimple: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  historyCard: {
    padding: Theme.spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyWinner: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  historyComm: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  shareIconBtn: {
    padding: 6,
    marginLeft: 4,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  monthGroup: {
    marginBottom: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Theme.spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: Theme.spacing.xs,
  },
  historyMonthLabel: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  monthTotal: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  winnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },

  // --- ANALYTICS VIEW STYLES ---
  donutCard: {
    padding: Theme.spacing.lg,
  },
  donutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 12,
  },
  donutSvgWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutLegendContainer: {
    flex: 1,
    gap: Theme.spacing.sm,
  },
  legendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabelText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  legendValText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  donutDetailSection: {
    marginTop: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Theme.spacing.md,
  },
  donutDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  donutDetailTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  clearLinkText: {
    color: Colors.info,
    fontSize: 12,
    fontWeight: 'bold',
  },
  donutDetailList: {
    gap: Theme.spacing.xs,
  },
  donutDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  donutDetailText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },

  // Bar Chart Styles
  barChartCard: {
    padding: Theme.spacing.lg,
  },
  chartInstructionText: {
    color: Colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
    fontStyle: 'italic',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.lg,
  },
  chartDetailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Theme.spacing.sm,
  },
  chartDetailsTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  shareBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D36620',
    borderColor: '#25D36640',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.round,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 3,
    gap: 4,
  },
  shareBtnPillText: {
    color: '#25D366',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detailCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailCardLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  detailCardVal: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },

  // Visual Balances List Styles
  visualDueRowContainer: {
    marginBottom: Theme.spacing.md,
  },
  visualDueRow: {
    backgroundColor: Colors.surface,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  visualDueRowSelected: {
    borderColor: Colors.secondary + '60',
    backgroundColor: Colors.surface + '80',
  },
  dueMemberMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  visualDueMemberName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  visualDueAmtText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressBarWrapper: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  memberActionSheet: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: Theme.borderRadius.sm,
    borderBottomRightRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.md,
    marginTop: -2,
    gap: Theme.spacing.sm,
  },
  actionSheetLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionSheetButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  sheetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    gap: 6,
  },
  callSheetBtn: {
    backgroundColor: Colors.info,
  },
  whatsappSheetBtn: {
    backgroundColor: Colors.success,
  },
  statementSheetBtn: {
    backgroundColor: Colors.secondary,
  },
  sheetBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
