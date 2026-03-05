import { supabase } from '../lib/supabase.js';

/**
 * GET /api/stats/dashboard
 * Admin dashboard summary statistics.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Run all queries in parallel
    const [
      booksRes,
      usersRes,
      borrowsTodayRes,
      revenueRes,
      borrowTrendsRes,
      revenueTrendsRes,
      recentBorrowsRes,
      copiesRes,
    ] = await Promise.all([
      // Total books
      supabase.from('books').select('id', { count: 'exact', head: true }),

      // Active users (status = 'active')
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),

      // Borrows created today
      supabase.from('borrow_records')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      // Total revenue from paid fines
      supabase.from('fines')
        .select('amount')
        .eq('status', 'paid'),

      // Monthly borrow counts (last 6 months)
      supabase.from('borrow_records')
        .select('created_at')
        .gte('created_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()),

      // Monthly revenue (last 6 months)
      supabase.from('fines')
        .select('amount, paid_at')
        .eq('status', 'paid')
        .gte('paid_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()),

      // Recent borrow activity (last 10)
      supabase.from('borrow_records')
        .select('id, status, created_at, user:profiles(full_name, avatar_url), copy:book_copies(book:books(title))')
        .order('created_at', { ascending: false })
        .limit(10),

      // Book copies status breakdown
      supabase.from('book_copies').select('condition'),
    ]);

    // ── Summary ────────────────────────────────────────────────────────────────
    const totalBooks = booksRes.count ?? 0;
    const activeUsers = usersRes.count ?? 0;
    const borrowedToday = borrowsTodayRes.count ?? 0;
    const revenue = (revenueRes.data ?? []).reduce((sum, f) => sum + (f.amount || 0), 0);

    // ── Monthly borrow trend ────────────────────────────────────────────────────
    const monthLabels = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
    });

    const borrowCounts = Array(6).fill(0);
    (borrowTrendsRes.data ?? []).forEach(r => {
      const d = new Date(r.created_at);
      const idx = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - (now.getMonth() - 5);
      if (idx >= 0 && idx < 6) borrowCounts[idx]++;
    });
    const borrowingTrend = monthLabels.map((month, i) => ({ month, count: borrowCounts[i] }));

    // ── Monthly revenue trend ───────────────────────────────────────────────────
    const revAmounts = Array(6).fill(0);
    (revenueTrendsRes.data ?? []).forEach(r => {
      if (!r.paid_at) return;
      const d = new Date(r.paid_at);
      const idx = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - (now.getMonth() - 5);
      if (idx >= 0 && idx < 6) revAmounts[idx] += r.amount || 0;
    });
    const revenueTrend = monthLabels.map((month, i) => ({ month, amount: revAmounts[i] }));

    // ── Book status breakdown ───────────────────────────────────────────────────
    const conditionMap = {};
    (copiesRes.data ?? []).forEach(c => {
      conditionMap[c.condition] = (conditionMap[c.condition] || 0) + 1;
    });
    const conditionColors = { good: '#22C55E', fair: '#F59E0B', poor: '#EF4444', lost: '#6B7280' };
    const bookStatus = Object.entries(conditionMap).map(([label, value]) => ({
      label,
      value,
      color: conditionColors[label] || '#3F51B5',
    }));

    // ── Recent activity ─────────────────────────────────────────────────────────
    const recentActivity = (recentBorrowsRes.data ?? []).map(r => ({
      id: r.id,
      user: {
        name: r.user?.full_name || 'Unknown',
        avatar: r.user?.avatar_url || null,
      },
      book: r.copy?.book?.title || 'Unknown book',
      action: r.status === 'returned' ? 'Return' : r.status === 'approved' ? 'Borrow' : 'Reserve',
      date: new Date(r.created_at).toLocaleDateString('vi-VN'),
      status: r.status === 'returned' ? 'Completed' : r.status === 'approved' ? 'Active' : 'Pending',
    }));

    return res.json({
      ok: true,
      data: {
        summary: {
          total_books: totalBooks,
          active_users: activeUsers,
          borrowed_today: borrowedToday,
          revenue,
        },
        trends: {
          borrowing: borrowingTrend,
          revenue: revenueTrend,
          user_growth: borrowingTrend, // reuse as placeholder
        },
        book_status: bookStatus.length ? bookStatus : [
          { label: 'good', value: 1, color: '#22C55E' },
        ],
        recent_activity: recentActivity,
      },
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
