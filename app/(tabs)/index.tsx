import React, { useState, useCallback, useLayoutEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { StatCard, EmptyState, Button, Card, Badge } from '../../src/components/ui';
import { ChitRepository, MemberRepository, RoundRepository, PaymentRepository, AuctionRepository, Chit } from '../../src/database';
import { ChitService } from '../../src/services/chitService';

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={{ marginRight: 16, padding: 8 }}
          onPress={() => setShowInfoModal(true)}
        >
          <Ionicons name="information-circle-outline" size={24} color="#eab308" />
        </TouchableOpacity>
      )
    });
  }, [navigation]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const chitRepo = new ChitRepository();
      const memberRepo = new MemberRepository();
      const roundRepo = new RoundRepository();
      const paymentRepo = new PaymentRepository();
      const auctionRepo = new AuctionRepository();
      const service = new ChitService();
      
      const chit = await chitRepo.getActiveChit();
      
      if (chit) {
        const [members, summary, rounds, bidInfo] = await Promise.all([
          memberRepo.getMembersByChit(chit.id),
          service.getFinancialSummary(chit.id),
          roundRepo.getRoundsByChit(chit.id),
          service.getCumulativeBidInfo(chit.id)
        ]);

        const pending = rounds.find(r => r.status === 'pending');
        const currentRound = pending || rounds[rounds.length - 1];

        let currentMonthCollected = 0;
        let currentMonthPending = 0;
        let memberPaymentsList: any[] = [];

        if (currentRound) {
          const roundSummary = await paymentRepo.getPaymentSummary(currentRound.id);
          currentMonthCollected = roundSummary.total_paid;
          currentMonthPending = Math.max(0, roundSummary.total_expected - roundSummary.total_paid);
          
          const payments = await paymentRepo.getPaymentsByRound(currentRound.id);
          const winnerList = await auctionRepo.getWinners(chit.id);
          const winnersSet = new Set(winnerList);
          
          memberPaymentsList = payments.map(p => {
            const isWinner = winnersSet.has(p.member_id);
            return {
              memberId: p.member_id,
              name: p.member_name,
              paidAmount: p.paid_amount,
              expectedAmount: p.expected_amount,
              status: p.status,
              isWinner
            };
          });
        }
        
        return {
          activeChit: chit,
          memberCount: members.length,
          financials: summary,
          currentMonth: summary.currentMonth,
          currentMonthCollected,
          currentMonthPending,
          memberPayments: memberPaymentsList,
          chitId: chit.id,
          cumulativeBidInfo: bidInfo,
        };
      }
      return { activeChit: null, memberCount: 0, financials: null, currentMonth: 0, currentMonthCollected: 0, currentMonthPending: 0, memberPayments: [], chitId: null, cumulativeBidInfo: null };
    },
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const activeChit = data?.activeChit;
  const memberCount = data?.memberCount || 0;
  const financials = data?.financials || {
    totalCommission: 0,
    totalCollected: 0,
    totalExpected: 0,
    totalOutstanding: 0,
    winnerCount: 0
  };
  const currentMonth = data?.currentMonth || 0;
  const currentMonthCollected = data?.currentMonthCollected || 0;
  const currentMonthPending = data?.currentMonthPending || 0;
  const memberPayments = data?.memberPayments || [];
  const cumulativeBidInfo = data?.cumulativeBidInfo;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleStartFund = async () => {
    if (!activeChit) return;
    setStarting(true);
    try {
      const service = new ChitService();
      await service.startChitFund(activeChit.id);
      refetch();
    } catch (e: any) {
      console.error('Failed to start chit fund:', e.message);
    } finally {
      setStarting(false);
    }
  };

  if (isLoading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#eab308" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  if (!activeChit && !isLoading) {
    return (
      <View style={styles.container}>
        <EmptyState 
          icon="business-outline"
          title="No Active Chit"
          message="You haven't created any chit fund yet. Start by creating your first chit fund to manage members and auctions."
          actionLabel="Create New Chit"
          onAction={() => router.push('/create-chit')}
        />
        <TouchableOpacity 
          style={[styles.switchButton, { alignSelf: 'center', marginTop: 20 }]}
          onPress={() => router.push('/switch-batch')}
        >
          <Text style={{color: '#ffffff', fontWeight: 'bold'}}>Switch Batch</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!activeChit) return null;

  const progress = activeChit ? (currentMonth / activeChit.duration_months) : 0;

  // Format Lakhs helper (e.g. ₹6,00,000 -> ₹6.0L)
  const formatLakhs = (paisaValue: number) => {
    const rupees = paisaValue / 100;
    if (rupees >= 100000) {
      const lakhs = rupees / 100000;
      return `₹${lakhs.toFixed(1)}L`;
    }
    return `₹${rupees.toLocaleString()}`;
  };

  // SVG ring variables
  const size = 180;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Container */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{activeChit.name}</Text>
          <Text style={styles.headerStatusText}>
            {activeChit.status.toUpperCase()} · CFM-COMM-{new Date(activeChit.start_date).getFullYear()}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/switch-batch')}>
            <Ionicons name="albums-outline" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/create-chit')}>
            <Ionicons name="add-outline" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/auction')}>
            <Ionicons name="hammer-outline" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {currentMonth === 0 ? (
        /* Setup status view if Month 1 is not started */
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>Group Setup Status</Text>
          <Text style={styles.setupText}>
            {memberCount < activeChit.member_count 
              ? `Please add ${activeChit.member_count - memberCount} more members to complete the group setup.`
              : `Setup complete! All ${activeChit?.member_count || 20} members are registered. You can now formally start the chit fund.`}
          </Text>
          <View style={styles.setupDetails}>
            <Text style={styles.setupDetailItem}>Total Value: {formatLakhs(activeChit.total_value)}</Text>
            <Text style={styles.setupDetailItem}>Target Members: {activeChit.member_count}</Text>
            <Text style={styles.setupDetailItem}>Added Members: {memberCount}</Text>
          </View>
          {memberCount === activeChit.member_count && (
            <Button 
              title="Start Month 1" 
              onPress={handleStartFund} 
              loading={starting}
              style={styles.actionButton}
            />
          )}
        </View>
      ) : (
        /* Main dashboard view */
        <>
          {/* Middle Circular Progress Ring */}
          <View style={styles.circleContainer}>
            <View style={styles.svgWrapper}>
              <Svg width={size} height={size} style={styles.circleSvg}>
                {/* Track Circle */}
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#1f2937"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                {/* Progress Circle */}
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#eab308"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${size / 2}, ${size / 2}`}
                />
              </Svg>
              <View style={styles.circleInnerContent}>
                <Text style={styles.circleLabel}>CHIT VALUE</Text>
                <Text style={styles.circleValueText}>{formatLakhs(activeChit.total_value)}</Text>
                <Text style={styles.circleSubText}>₹{(activeChit.monthly_contribution / 100).toLocaleString()} / month</Text>
              </View>
            </View>

            {/* Active Round Status Pill */}
            <View style={styles.monthPill}>
              <View style={styles.pulseDot} />
              <Text style={styles.monthPillText}>Month {currentMonth} of {activeChit.duration_months} in progress</Text>
            </View>
          </View>

          {/* 2x2 Grid of Stat Cards */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                <Ionicons name="calendar-outline" size={12} color="#9ca3af" /> THIS MONTH
              </Text>
              <Text style={styles.statValue}>₹{(currentMonthCollected / 100).toLocaleString()}</Text>
              <View style={styles.statSubRow}>
                <View style={[styles.bullet, { backgroundColor: currentMonthPending > 0 ? '#ef4444' : '#10b981' }]} />
                <Text style={[styles.statSubText, { color: currentMonthPending > 0 ? '#ef4444' : '#10b981' }]}>
                  {currentMonthPending > 0 ? `₹${(currentMonthPending / 100).toLocaleString()} pending` : 'All settled'}
                </Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                <Ionicons name="trending-up-outline" size={12} color="#9ca3af" /> CUMULATIVE BIDS
              </Text>
              <Text style={styles.statValue}>₹{((cumulativeBidInfo?.cumulativeTotal || 0) / 100).toLocaleString()}</Text>
              <View style={styles.statSubRow}>
                <View style={[styles.bullet, { backgroundColor: cumulativeBidInfo?.exceeded ? '#ef4444' : '#10b981' }]} />
                <Text style={[styles.statSubText, { color: cumulativeBidInfo?.exceeded ? '#ef4444' : '#10b981' }]}>
                  {cumulativeBidInfo?.exceeded
                    ? `Exceeded by ₹${(((cumulativeBidInfo?.cumulativeTotal || 0) - (cumulativeBidInfo?.totalValue || 0)) / 100).toLocaleString()}`
                    : `₹${(((cumulativeBidInfo?.totalValue || 0) - (cumulativeBidInfo?.cumulativeTotal || 0)) / 100).toLocaleString()} remaining`
                  }
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                <Ionicons name="people-outline" size={12} color="#9ca3af" /> MEMBERS
              </Text>
              <Text style={styles.statValue}>{memberCount} / {activeChit.member_count}</Text>
              <View style={styles.statSubRow}>
                <View style={[styles.bullet, { backgroundColor: memberCount === activeChit.member_count ? '#10b981' : '#f59e0b' }]} />
                <Text style={[styles.statSubText, { color: memberCount === activeChit.member_count ? '#10b981' : '#f59e0b' }]}>
                  {memberCount === activeChit.member_count ? 'Group full' : `${activeChit.member_count - memberCount} remaining`}
                </Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                <Ionicons name="trophy-outline" size={12} color="#9ca3af" /> WINNERS
              </Text>
              <Text style={styles.statValue}>{financials.winnerCount} / {activeChit.member_count}</Text>
              <View style={styles.statSubRow}>
                <View style={[styles.bullet, { backgroundColor: '#eab308' }]} />
                <Text style={[styles.statSubText, { color: '#eab308' }]}>
                  {activeChit.member_count - financials.winnerCount} remaining
                </Text>
              </View>
            </View>
          </View>

          {/* Fund Progress Card */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>FUND PROGRESS</Text>
            <TouchableOpacity onPress={() => router.push('/payments')}>
              <Text style={styles.sectionHeaderLink}>View rounds ›</Text>
            </TouchableOpacity>
          </View>

          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Month {currentMonth} of {activeChit.duration_months}</Text>
              <Text style={styles.percentageText}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.progressFooter}>
              <View style={styles.footerLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.footerText}>{financials.winnerCount} members won</Text>
              </View>
              <View style={styles.footerRight}>
                <Ionicons name="calendar-outline" size={14} color="#9ca3af" style={{ marginRight: 4 }} />
                <Text style={styles.footerText}>{activeChit.duration_months - currentMonth} months left</Text>
              </View>
            </View>
          </Card>

          {/* Member Payments horizontal pills list */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>MEMBER PAYMENTS</Text>
            <TouchableOpacity onPress={() => router.push('/payments')}>
              <Text style={styles.sectionHeaderLink}>All members ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.memberScrollContent}
          >
            {memberPayments.map((member) => {
              const initials = member.name.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase().substring(0, 2);
              
              let statusText = 'Pending';
              let statusColor = '#ef4444';
              let hasBorderColor = '#1f2937';
              let hasBgColor = '#111827';
              
              if (member.isWinner) {
                statusText = '🏆 Winner';
                statusColor = '#eab308';
                hasBorderColor = '#eab30840';
                hasBgColor = '#eab30810';
              } else if (member.paidAmount >= member.expectedAmount) {
                statusText = 'Paid ✓';
                statusColor = '#10b981';
                hasBorderColor = '#10b98130';
                hasBgColor = '#10b98105';
              } else if (member.paidAmount > 0) {
                statusText = 'Partial';
                statusColor = '#f59e0b';
                hasBorderColor = '#f59e0b30';
                hasBgColor = '#f59e0b05';
              }

              return (
                <TouchableOpacity 
                  key={member.memberId} 
                  style={[
                    styles.memberPillCard, 
                    { borderColor: hasBorderColor, backgroundColor: hasBgColor }
                  ]}
                  onPress={() => router.push({ pathname: '/member-detail', params: { id: member.memberId } })}
                >
                  <View style={styles.memberPillAvatar}>
                    <Text style={styles.memberPillAvatarText}>{initials}</Text>
                  </View>
                  <View style={styles.memberPillDetails}>
                    <Text style={styles.memberPillName} numberOfLines={1}>{member.name}</Text>
                    <Text style={[styles.memberPillStatus, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {memberPayments.length === 0 && (
              <Text style={styles.emptyText}>No payments logged for this round.</Text>
            )}
          </ScrollView>
        </>
      )}

      {/* Premium Commercial License & Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#eab308" />
                <Text style={styles.modalMainTitle}>Chit Fund Manager</Text>
              </View>
              <Badge label="COMMERCIAL" variant="success" />
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Product Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSecTitle}>Product Summary</Text>
                <Text style={styles.modalText}>
                  A premium, high-density secure ledger application designed specifically for commercial chit fund management, dividend payouts, and member payment reconciliation.
                </Text>
              </View>

              {/* Proprietary Rights & Legal Notice */}
              <View style={styles.modalSection}>
                <Text style={[styles.modalSecTitle, { color: '#F59E0B' }]}>Proprietary & Legal Notice</Text>
                <Text style={styles.modalText}>
                  This application, including all source code, database structures, workflows, and visual designs, is the exclusive intellectual property of <Text style={styles.highlightText}>Yugandhar</Text>.
                </Text>
                <Text style={styles.modalSubtext}>
                  All rights reserved. Unauthorized copying, distribution, decompilation, or reverse engineering of this software is strictly prohibited and subject to legal prosecution.
                </Text>
              </View>

              {/* License Credentials */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSecTitle}>License Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Owner & Licensee</Text>
                  <Text style={styles.detailVal}>Yugandhar</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>License ID</Text>
                  <Text style={styles.detailVal}>CFM-COMM-2026-001</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Environment</Text>
                  <Text style={styles.detailVal}>Secure Commercial Production</Text>
                </View>
              </View>

              {/* Contact Support */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSecTitle}>Support & Contact</Text>
                <TouchableOpacity 
                  style={styles.contactLink}
                  onPress={() => Alert.alert('Email Support', 'Contact: yoyugandher@gmail.com')}
                >
                  <Ionicons name="mail-outline" size={16} color="#9ca3af" />
                  <Text style={styles.contactLinkText}>yoyugandher@gmail.com</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.contactLink}
                  onPress={() => Alert.alert('Phone Support', 'Contact: +91 7205938316')}
                >
                  <Ionicons name="call-outline" size={16} color="#9ca3af" />
                  <Text style={styles.contactLinkText}>+91 7205938316</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <Button 
              title="Close Panel" 
              onPress={() => setShowInfoModal(false)}
              variant="secondary"
              style={styles.modalCloseBtn}
            />
          </Card>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16', // Deep navy midnight background matching screenshot
  },
  content: {
    padding: Theme.spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerStatusText: {
    color: '#eab308',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  svgWrapper: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleSvg: {
    position: 'absolute',
  },
  circleInnerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  circleValueText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  circleSubText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eab30810',
    borderWidth: 1,
    borderColor: '#eab30830',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#eab308',
  },
  monthPillText: {
    color: '#eab308',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  statSubText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sectionHeaderLink: {
    color: '#eab308',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressCard: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    padding: 16,
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  percentageText: {
    color: '#eab308',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1f2937',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#eab308',
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  memberScrollContent: {
    paddingVertical: 4,
    paddingRight: Theme.spacing.lg,
    gap: 10,
    flexDirection: 'row',
  },
  memberPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 30,
    borderWidth: 1,
    gap: 8,
  },
  memberPillAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberPillAvatarText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 'bold',
  },
  memberPillDetails: {
    justifyContent: 'center',
  },
  memberPillName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  memberPillStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 1,
  },
  setupCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 24,
    marginTop: 12,
  },
  setupTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  setupText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  setupDetails: {
    backgroundColor: '#090d16',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  setupDetailItem: {
    color: '#ffffff',
    fontSize: 13,
  },
  actionButton: {
    marginTop: 20,
  },
  switchButton: {
    padding: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  emptyText: {
    color: '#9ca3af',
    fontStyle: 'italic',
    fontSize: 12,
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#111827',
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingBottom: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalMainTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScrollContent: {
    paddingBottom: Theme.spacing.lg,
  },
  modalSection: {
    marginBottom: Theme.spacing.lg,
  },
  modalSecTitle: {
    color: '#eab308',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  modalText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  modalSubtext: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  highlightText: {
    color: '#eab308',
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  detailKey: {
    color: '#9ca3af',
    fontSize: 13,
  },
  detailVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  contactLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  contactLinkText: {
    color: '#ffffff',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  modalCloseBtn: {
    marginTop: Theme.spacing.md,
  },
});
