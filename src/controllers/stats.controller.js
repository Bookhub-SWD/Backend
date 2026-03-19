import { supabase } from '../lib/supabase.js';
import * as XLSX from 'xlsx';

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
      let catName = 'Uncategorized';
      if (item.subject) {
        const subjectObj = Array.isArray(item.subject) ? item.subject[0] : item.subject;
        const rawName = subjectObj?.category || subjectObj?.name || 'Uncategorized';
        catName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      }

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

    const categoryColors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];
    const bookCategories = Object.entries(categoryMap)
      .map(([name, count], index) => ({
        name,
        count,
        color: categoryColors[index % categoryColors.length]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // ── Recent activity ─────────────────────────────────────────────────────────
    const recentActivity = (recentBorrowsRes.data ?? []).map(r => ({
      id: r.id,
      user: {
        name: r.user?.full_name || 'Unknown',
        avatar: null,
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
          user_growth: borrowingTrend,
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
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('borrow_records')
      .select('created_at')
      .gte('created_at', monday.toISOString())
      .lte('created_at', sunday.toISOString());

    if (error) throw error;

    const trendMap = [
      { name: 'Thứ 2', count: 0 },
      { name: 'Thứ 3', count: 0 },
      { name: 'Thứ 4', count: 0 },
      { name: 'Thứ 5', count: 0 },
      { name: 'Thứ 6', count: 0 },
      { name: 'Thứ 7', count: 0 },
      { name: 'Chủ nhật', count: 0 }
    ];

    const dayIndices = [6, 0, 1, 2, 3, 4, 5];

    (data || []).forEach(r => {
      const d = new Date(r.created_at);
      const dayIndex = d.getDay();
      const trendIdx = dayIndices[dayIndex];
      if (trendMap[trendIdx]) {
        trendMap[trendIdx].count++;
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

/**
 * GET /api/stats/export
 * Export full library data to Excel.
 */
export const exportLibraryReport = async (req, res) => {
  try {
    console.log('Generating Excel report...');
    
    // Fetch all data for reports
    const [usersRes, booksRes, borrowsRes, finesRes] = await Promise.all([
      supabase.from('users').select('id, full_name, email, phone, status, created_at'),
      supabase.from('books').select('id, title, author, isbn, category:subjects(name), published_year'),
      supabase.from('borrow_records').select('id, created_at, status, borrow_date, due_date, return_date, user:users(full_name), copy:book_copies(book:books(title))'),
      supabase.from('fines').select('id, amount, status, paid_at, created_at, user:users(full_name), borrow_record:borrow_records(copy:book_copies(book:books(title)))')
    ]);

    if (usersRes.error) throw usersRes.error;
    if (booksRes.error) throw booksRes.error;
    if (borrowsRes.error) throw borrowsRes.error;
    if (finesRes.error) throw finesRes.error;

    // Prepare Sheets
    const wb = XLSX.utils.book_new();

    // 1. Users Sheet
    const usersData = (usersRes.data || []).map(u => ({
      'ID': u.id,
      'Họ tên': u.full_name,
      'Email': u.email,
      'Số điện thoại': u.phone || 'N/A',
      'Trạng thái': u.status,
      'Ngày tham gia': new Date(u.created_at).toLocaleDateString('vi-VN')
    }));
    const wsUsers = XLSX.utils.json_to_sheet(usersData);
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Người dùng');

    // 2. Books Sheet
    const booksData = (booksRes.data || []).map(b => ({
      'ID': b.id,
      'Tiêu đề': b.title,
      'Tác giả': b.author,
      'ISBN': b.isbn || 'N/A',
      'Thể loại': Array.isArray(b.category) ? b.category.map(c => c.name).join(', ') : b.category?.name || 'Chưa phân loại',
      'Năm xuất bản': b.published_year || 'N/A'
    }));
    const wsBooks = XLSX.utils.json_to_sheet(booksData);
    XLSX.utils.book_append_sheet(wb, wsBooks, 'Kho sách');

    // 3. Borrows Sheet
    const borrowsData = (borrowsRes.data || []).map(r => ({
      'ID': r.id,
      'Người mượn': r.user?.full_name || 'N/A',
      'Sách': r.copy?.book?.title || 'N/A',
      'Trạng thái': r.status,
      'Ngày mượn': r.borrow_date ? new Date(r.borrow_date).toLocaleDateString('vi-VN') : 'N/A',
      'Hạn trả': r.due_date ? new Date(r.due_date).toLocaleDateString('vi-VN') : 'N/A',
      'Ngày trả thực tế': r.return_date ? new Date(r.return_date).toLocaleDateString('vi-VN') : '---'
    }));
    const wsBorrows = XLSX.utils.json_to_sheet(borrowsData);
    XLSX.utils.book_append_sheet(wb, wsBorrows, 'Mượn trả');

    // 4. Fines Sheet
    const finesData = (finesRes.data || []).map(f => ({
      'Số tiền (VND)': f.amount,
      'Người nộp': f.user?.full_name || 'N/A',
      'Lý do (Tên sách)': f.borrow_record?.copy?.book?.title || 'Phạt hệ thống',
      'Trạng thái': f.status,
      'Ngày thanh toán': f.paid_at ? new Date(f.paid_at).toLocaleDateString('vi-VN') : 'Chưa nộp',
      'Ngày tạo': new Date(f.created_at).toLocaleDateString('vi-VN')
    }));
    const wsFines = XLSX.utils.json_to_sheet(finesData);
    XLSX.utils.book_append_sheet(wb, wsFines, 'Tiền phạt');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=BookHub_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    return res.send(buf);

  } catch (err) {
    console.error('exportLibraryReport error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error', error: err.message });
  }
};
