import { supabase } from '../lib/supabase.js';

/**
 * GET /api/stats/dashboard
 * Admin dashboard summary statistics.
 */
export const getDashboardStats = async (req, res) => {
  try {
    console.log('Fetching dashboard statistics...');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Run all queries in parallel
    const [
      booksRes,
      borrowedRes,
      overdueRes,
      unpaidFinesRes,
      borrowTrendsRes,
      revenueTrendsRes,
      recentBorrowsRes,
      copiesRes,
      categoriesRes,
      activeUsersRes,
      borrowedTodayRes,
    ] = await Promise.all([
      // Total books
      supabase.from('books').select('id', { count: 'exact', head: true }),

      // Currently borrowed books (status = 'borrowed')
      supabase.from('borrow_records').select('id', { count: 'exact', head: true }).eq('status', 'borrowed'),

      // Overdue books (status = 'overdue')
      supabase.from('borrow_records').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),

      // Unpaid fines (status = 'pending')
      supabase.from('fines').select('id', { count: 'exact', head: true }).eq('status', 'pending'),

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
        .select('id, status, created_at, user:users!user_id(full_name), copy:book_copies(book:books(title))')
        .order('created_at', { ascending: false })
        .limit(10),

      // Book copies status breakdown
      supabase.from('book_copies').select('condition'),

      // Book categories breakdown via book_subjects junction table
      supabase.from('book_subjects').select('book_id, subject:subjects(category, name)'),

      // Total active users
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),

      // Borrowed today
      supabase.from('borrow_records').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    ]);

    console.log('Dashboard queries completed.');

    // ── Summary ────────────────────────────────────────────────────────────────
    const totalBooks = booksRes.count ?? 0;
    const currentlyBorrowed = borrowedRes.count ?? 0;
    const overdueItems = overdueRes.count ?? 0;
    const unpaidFines = unpaidFinesRes.count ?? 0;
    const activeUsers = activeUsersRes.count ?? 0;
    const borrowedToday = borrowedTodayRes.count ?? 0;

    // ── Monthly borrow trend ────────────────────────────────────────────────────

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

    // ── Book categories breakdown ───────────────────────────────────────────────────
    const categoryBooksMap = {};
    (categoriesRes.data ?? []).forEach(item => {
      // Use subject.category if available, fallback to subject.name, then 'Uncategorized'
      let catName = 'Uncategorized';
      if (item.subject) {
        // If subject is an array (due to some postgrest setups), handle it
        const subjectObj = Array.isArray(item.subject) ? item.subject[0] : item.subject;
        // Capitalize for better display and cleanliness
        const rawName = subjectObj?.category || subjectObj?.name || 'Uncategorized';
        // Basic normalization to group similar categories
        catName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      }

      // Keep track of unique book_ids per category to avoid inflating the numbers 
      // if a book has 2 subjects that both fall under the same category label.
      if (!categoryBooksMap[catName]) {
        categoryBooksMap[catName] = new Set();
      }
      if (item.book_id) {
        categoryBooksMap[catName].add(item.book_id);
      }
    });

    const categoryMap = {};
    Object.keys(categoryBooksMap).forEach(cat => {
      categoryMap[cat] = categoryBooksMap[cat].size;
    });

    // Aesthetic color palette for categories
    const categoryColors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];
    const bookCategories = Object.entries(categoryMap)
      .map(([name, count], index) => ({
        name,
        count,
        color: categoryColors[index % categoryColors.length]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // Top 6 categories

    // ── Recent activity ─────────────────────────────────────────────────────────
    const recentActivity = (recentBorrowsRes.data ?? []).map(r => ({
      id: r.id,
      user: {
        name: r.user?.full_name || 'Unknown',
        avatar: null, // avatar_url is not in our users table
      },
      book: r.copy?.book?.title || 'Unknown book',
      action: r.status === 'returned' ? 'Return' : r.status === 'approved' ? 'Borrow' : 'Reserve',
      date: new Date(r.created_at).toLocaleDateString('vi-VN'),
      status: r.status === 'returned' ? 'Completed' : r.status === 'approved' ? 'Active' : 'Pending',
    }));

    const totalRevenue = (revenueTrendsRes.data ?? []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return res.json({
      ok: true,
      data: {
        summary: {
          total_books: totalBooks,
          active_users: activeUsers,
          borrowed_today: borrowedToday,
          revenue: totalRevenue,
          currently_borrowed: currentlyBorrowed,
          overdue_items: overdueItems,
          unpaid_fines: unpaidFines,
        },
        trends: {
          borrowing: borrowingTrend,
          revenue: revenueTrend,
          user_growth: borrowingTrend, // reuse as placeholder
        },
        book_status: bookStatus.length ? bookStatus : [
          { label: 'good', value: 1, color: '#22C55E' },
        ],
        book_categories: bookCategories,
        recent_activity: recentActivity,
      },
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /api/stats/borrowing-trends
 * Daily borrowing counts aggregated by day of the week across all time.
 */
export const getBorrowingTrends = async (req, res) => {
  try {
    // Fetch all borrow records
    const { data, error } = await supabase
      .from('borrow_records')
      .select('created_at');

    if (error) throw error;

    // Initialize map for the week (Mon -> Sun)
    const trendMap = [
      { name: 'Mon', count: 0 },
      { name: 'Tue', count: 0 },
      { name: 'Wed', count: 0 },
      { name: 'Thu', count: 0 },
      { name: 'Fri', count: 0 },
      { name: 'Sat', count: 0 },
      { name: 'Sun', count: 0 }
    ];

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Aggregate counts
    (data || []).forEach(r => {
      const d = new Date(r.created_at);
      const dayLabel = days[d.getDay()];
      const dayEntry = trendMap.find(item => item.name === dayLabel);
      if (dayEntry) {
        dayEntry.count++;
      }
    });

    return res.json({
      ok: true,
      data: trendMap
    });
  } catch (err) {
    console.error('getBorrowingTrends error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

