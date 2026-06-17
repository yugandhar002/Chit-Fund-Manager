import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, Linking, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Card, Badge, Button } from '../src/components/ui';
import { MemberRepository, PaymentRepository, AuctionRepository, ChitRepository, Member, Payment, Chit } from '../src/database';

export default function MemberStatementScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();

  const [loading, setLoading] = useState(true);
  const [sharingText, setSharingText] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  const [member, setMember] = useState<Member | null>(null);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [payments, setPayments] = useState<(Payment & { month_number: number })[]>([]);
  const [winnerStatus, setWinnerStatus] = useState<string>('Saver (Not won yet)');
  const [wonMonth, setWonMonth] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!memberId) return;
    try {
      const memberRepo = new MemberRepository();
      const paymentRepo = new PaymentRepository();
      const auctionRepo = new AuctionRepository();
      const chitRepo = new ChitRepository();

      const mId = parseInt(memberId);
      const memberData = await memberRepo.getMemberById(mId);
      setMember(memberData);

      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);

      if (memberData && chit) {
        const [paymentList, auctionHistory] = await Promise.all([
          paymentRepo.getPaymentsByMember(mId),
          auctionRepo.getAuctionHistory(chit.id)
        ]);

        setPayments(paymentList);

        // Calculate if member won the pot
        const wonAuction = auctionHistory.find(a => a.winner_member_id === mId);
        if (wonAuction) {
          setWonMonth(wonAuction.month_number);
          setWinnerStatus(
            `Won Month ${wonAuction.month_number} (Bid: ₹${(wonAuction.commission_amount / 100).toLocaleString()})`
          );
        }
      }
    } catch (e) {
      console.error('Failed to load member statement data:', e);
      Alert.alert('Error', 'Failed to load member insights.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Financial aggregates
  const totalExpected = payments.reduce((sum, p) => sum + (p.expected_amount || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
  const remainingDues = totalExpected - totalPaid;
  const isOwes = remainingDues > 0;

  // WhatsApp text reminder compiling
  const handleShareText = async () => {
    if (!member || !activeChit) return;
    setSharingText(true);
    try {
      let ledgerText = `*STATEMENT OF ACCOUNT — ${activeChit.name.toUpperCase()}*\n` +
        `-----------------------------------------\n` +
        `*Member Name:* ${member.name}\n` +
        `*Phone Number:* ${member.phone || 'N/A'}\n` +
        `*Status:* ${winnerStatus}\n\n` +
        `*FINANCIAL SUMMARY:*\n` +
        `• Total Expected: ₹${(totalExpected / 100).toLocaleString()}\n` +
        `• Total Paid: ₹${(totalPaid / 100).toLocaleString()}\n` +
        `• Outstanding Balance: *₹${(Math.abs(remainingDues) / 100).toLocaleString()}* ${isOwes ? '(Pending)' : '(Credit)'}\n\n` +
        `*MONTH-BY-MONTH BREAKDOWN:*\n`;

      payments.forEach(p => {
        ledgerText += `• Month ${p.month_number}: Expected: ₹${(p.expected_amount / 100).toLocaleString()} | Paid: ₹${(p.paid_amount / 100).toLocaleString()} | Status: ${p.status.toUpperCase()}\n`;
      });

      ledgerText += `-----------------------------------------\n` +
        `Generated on: ${new Date().toLocaleDateString()}\n` +
        `Thank you! Best regards. 🙏`;

      let cleanPhone = (member.phone || '').trim().replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      }

      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(ledgerText)}`;
      await Linking.openURL(url);
    } catch (e) {
      console.error(e);
      Alert.alert('Share Error', 'Failed to share to WhatsApp.');
    } finally {
      setSharingText(false);
    }
  };

  // HTML & PDF statement compiling
  const handleSharePdf = async () => {
    if (!member || !activeChit) return;
    setSharingPdf(true);
    try {
      const paymentsHtml = payments
        .map(
          p => `
          <tr>
            <td>Month ${p.month_number}</td>
            <td>₹${(p.expected_amount / 100).toLocaleString()}</td>
            <td>₹${(p.paid_amount / 100).toLocaleString()}</td>
            <td>
              <span class="badge badge-${p.status}">
                ${p.status}
              </span>
            </td>
          </tr>
        `
        )
        .join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Member Statement - ${member.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 25px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #D4A844; padding-bottom: 15px; margin-bottom: 25px; }
            .company-title { font-size: 24px; font-weight: bold; color: #0A1628; margin: 0; }
            .company-sub { font-size: 12px; color: #64748b; margin: 4px 0 0 0; }
            .invoice-title { font-size: 20px; font-weight: bold; color: #D4A844; text-align: right; margin: 0; }
            .invoice-date { font-size: 11px; color: #64748b; text-align: right; margin: 4px 0 0 0; }
            
            .meta-grid { display: flex; justify-content: space-between; margin-bottom: 25px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .meta-col { flex: 1; }
            .meta-label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; font-weight: bold; letter-spacing: 0.5px; }
            .meta-value { font-size: 13px; font-weight: bold; color: #0A1628; }
            
            .summary-cards { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 30px; }
            .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background-color: #f8fafc; text-align: center; }
            .card-label { font-size: 10px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
            .card-value { font-size: 18px; font-weight: bold; }
            .value-expected { color: #0A1628; }
            .value-paid { color: #10B981; }
            .value-due { color: #EF4444; }
            .value-credit { color: #F59E0B; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background-color: #0A1628; color: #FFFFFF; text-align: left; padding: 12px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            
            .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
            .badge-paid { background-color: #d1fae5; color: #065f46; }
            .badge-partial { background-color: #fef3c7; color: #92400e; }
            .badge-pending { background-color: #f1f5f9; color: #475569; }
            .badge-refunded { background-color: #d1fae5; color: #065f46; }
            .badge-overpaid { background-color: #fef3c7; color: #92400e; }
            
            .footer { text-align: center; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company-title">${activeChit.name.toUpperCase()}</div>
              <div class="company-sub">Chit Fund Manager · Secure Ledger Statement</div>
            </div>
            <div>
              <div class="invoice-title">LEDGER STATEMENT</div>
              <div class="invoice-date">Date: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-col">
              <div class="meta-label">Member Details</div>
              <div class="meta-value">${member.name}</div>
              <div class="meta-value" style="font-weight: normal; color: #64748b; font-size: 12px; margin-top: 2px;">Phone: ${member.phone || 'N/A'}</div>
            </div>
            <div class="meta-col">
              <div class="meta-label">Winner Status</div>
              <div class="meta-value" style="color: #D4A844;">${winnerStatus}</div>
            </div>
            <div class="meta-col" style="text-align: right;">
              <div class="meta-label">Chit Value</div>
              <div class="meta-value">₹${(activeChit.total_value / 100).toLocaleString()}</div>
              <div class="meta-value" style="font-weight: normal; color: #64748b; font-size: 12px; margin-top: 2px;">${activeChit.duration_months} Months Batch</div>
            </div>
          </div>
          
          <div class="summary-cards">
            <div class="card">
              <div class="card-label">Total Expected</div>
              <div class="card-value value-expected">₹${(totalExpected / 100).toLocaleString()}</div>
            </div>
            <div class="card">
              <div class="card-label">Total Contribution Paid</div>
              <div class="card-value value-paid">₹${(totalPaid / 100).toLocaleString()}</div>
            </div>
            <div class="card">
              <div class="card-label">${isOwes ? 'Outstanding Balance' : 'Overpaid Balance'}</div>
              <div class="card-value ${isOwes ? 'value-due' : 'value-credit'}">
                ₹${(Math.abs(remainingDues) / 100).toLocaleString()}
              </div>
            </div>
          </div>
          
          <h3 style="font-size: 15px; color: #0A1628; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Month-by-Month Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Round No</th>
                <th>Expected Contribution</th>
                <th>Paid Amount</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsHtml}
            </tbody>
          </table>
          
          <div class="footer">
            This statement was generated electronically by Chit Fund Manager. Legal ownership remains with Yugandhar.<br>
            All Rights Reserved.
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (e) {
      console.error('Failed to export PDF:', e);
      Alert.alert('Export Error', 'Failed to generate PDF statement.');
    } finally {
      setSharingPdf(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Ledger Statement' }} />
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>Loading Statement...</Text>
      </View>
    );
  }

  if (!member || !activeChit) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Ledger Statement' }} />
        <Text style={styles.errorText}>Member or Chit not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: `${member.name} Ledger`,
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.textPrimary,
      }} />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberPhone}>{member.phone || 'No phone registered'}</Text>
              {member.address ? <Text style={styles.memberAddress}>{member.address}</Text> : null}
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusLabel}>CHIT POT STATUS</Text>
              <Text style={[styles.statusValue, wonMonth ? { color: Colors.secondary } : null]}>
                {winnerStatus}
              </Text>
            </View>
            {wonMonth && <Badge label="WINNER" variant="warning" />}
          </View>
        </Card>

        {/* Aggregates Dashboard */}
        <Text style={styles.sectionTitle}>Financial Summary</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Expected</Text>
            <Text style={styles.statValue}>₹{(totalExpected / 100).toLocaleString()}</Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Total Paid</Text>
            <Text style={[styles.statValue, { color: Colors.success }]}>₹{(totalPaid / 100).toLocaleString()}</Text>
          </Card>
        </View>

        <Card style={[styles.duesCard, isOwes ? styles.owesCard : styles.creditCard]}>
          <View style={styles.duesHeader}>
            <Ionicons 
              name={isOwes ? "alert-circle-outline" : "checkmark-circle-outline"} 
              size={24} 
              color={isOwes ? Colors.error : Colors.warning} 
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.duesLabel}>{isOwes ? 'OUTSTANDING BALANCE' : 'OVERPAID CREDIT'}</Text>
              <Text style={[styles.duesValue, { color: isOwes ? Colors.error : Colors.warning }]}>
                ₹{(Math.abs(remainingDues) / 100).toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>

        {/* ledger breakdown list */}
        <Text style={styles.sectionTitle}>Month-by-Month Ledger</Text>
        <Card style={styles.ledgerCard}>
          {payments.length > 0 ? (
            payments.map((p, index) => {
              const owes = p.expected_amount - p.paid_amount;
              const pillVariant = p.status === 'paid' || p.status === 'refunded' ? 'success' : p.status === 'partial' ? 'warning' : 'info';
              
              return (
                <View key={p.id} style={[
                  styles.ledgerRow,
                  index !== payments.length - 1 && styles.borderBottom
                ]}>
                  <View style={styles.ledgerLeft}>
                    <Text style={styles.ledgerMonth}>Month {p.month_number}</Text>
                    <Text style={styles.ledgerDuesText}>
                      ₹{(p.paid_amount / 100).toLocaleString()} of ₹{(p.expected_amount / 100).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.ledgerRight}>
                    <Badge label={p.status.toUpperCase()} variant={pillVariant} />
                    {owes > 0 && (
                      <Text style={styles.ledgerOwesMini}>Owes ₹{(owes / 100).toLocaleString()}</Text>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No round payments recorded yet.</Text>
          )}
        </Card>
      </ScrollView>

      {/* Floating share/action bar at bottom */}
      <View style={styles.actionBar}>
        <Button 
          title="Share (WhatsApp)"
          onPress={handleShareText}
          loading={sharingText}
          variant="secondary"
          style={{ ...styles.actionBtn, marginRight: 10 }}
          icon={<Ionicons name="logo-whatsapp" size={18} color={Colors.textPrimary} style={{ marginRight: 6 }} />}
        />
        <Button 
          title="Export PDF"
          onPress={handleSharePdf}
          loading={sharingPdf}
          style={styles.actionBtn}
          icon={<Ionicons name="document-outline" size={18} color="#0A1628" style={{ marginRight: 6 }} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: Theme.spacing.xl,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: Theme.spacing.md,
    fontSize: 15,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.lg,
    paddingBottom: 100, // margin to not cover by actions bar
  },
  profileCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  profileMeta: {
    flex: 1,
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberPhone: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  memberAddress: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Theme.spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  duesCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  owesCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    backgroundColor: Colors.error + '10',
  },
  creditCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    backgroundColor: Colors.warning + '10',
  },
  duesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duesLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  duesValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  ledgerCard: {
    padding: Theme.spacing.md,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ledgerLeft: {
    flex: 1,
  },
  ledgerMonth: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  ledgerDuesText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  ledgerRight: {
    alignItems: 'flex-end',
  },
  ledgerOwesMini: {
    color: Colors.error,
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Theme.spacing.md,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 24 : Theme.spacing.md,
  },
  actionBtn: {
    flex: 1,
    height: 46,
  },
});
