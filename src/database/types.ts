export interface Chit {
  id: number;
  name: string;
  total_value: number;
  member_count: number;
  monthly_contribution: number;
  duration_months: number;
  start_date: string;
  status: 'active' | 'completed';
  created_at: string;
}

export interface Member {
  id: number;
  chit_id: number;
  name: string;
  phone?: string;
  address?: string;
  is_organizer: number;
  status: 'active' | 'withdrawn';
  created_at: string;
}

export interface MonthlyRound {
  id: number;
  chit_id: number;
  month_number: number;
  round_date?: string;
  is_organizer_month: number;
  is_double_pata: number;
  status: 'pending' | 'completed';
  created_at: string;
}

export interface Auction {
  id: number;
  round_id: number;
  winner_member_id: number;
  commission_amount: number;
  payout_amount: number;
  dividend_per_member: number;
  effective_contribution: number;
  auction_number: number;
  created_at: string;
}

export interface Payment {
  id: number;
  round_id: number;
  member_id: number;
  expected_amount: number;
  paid_amount: number;
  payment_date?: string;
  status: 'pending' | 'partial' | 'paid' | 'late';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: number;
  payment_id: number;
  amount: number;
  payment_date: string;
  notes?: string;
}
