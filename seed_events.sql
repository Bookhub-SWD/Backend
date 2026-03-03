-- ==========================================
-- SEED DATA: events & event_registrations
-- ==========================================
-- NOTE: Thay 'USER_ID_1', 'USER_ID_2',... bằng UUID thật từ bảng public.users
-- Chạy lệnh này để lấy user IDs:  SELECT id, full_name, email FROM public.users LIMIT 5;

-- Lấy user đầu tiên làm người tạo event
-- Bạn có thể chạy trực tiếp trên Supabase SQL Editor

DO $$
DECLARE
  v_creator_id uuid;
  v_user1 uuid;
  v_user2 uuid;
  v_user3 uuid;
BEGIN
  -- Lấy user có role admin/staff làm creator
  SELECT id INTO v_creator_id FROM public.users LIMIT 1;
  -- Lấy 3 user khác để đăng ký
  SELECT id INTO v_user1 FROM public.users OFFSET 0 LIMIT 1;
  SELECT id INTO v_user2 FROM public.users OFFSET 1 LIMIT 1;
  SELECT id INTO v_user3 FROM public.users OFFSET 2 LIMIT 1;

  -- =====================
  -- INSERT EVENTS
  -- =====================

  -- 1. Sự kiện sắp tới (upcoming)
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Hội thảo Đọc sách cùng nhau',
    'Sự kiện giao lưu đọc sách và chia sẻ cảm nhận về các tác phẩm văn học nổi tiếng. Tham gia để kết nối với cộng đồng yêu sách!',
    'Thư viện Trung tâm - Tầng 3, Phòng hội thảo A',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800',
    50,
    '2026-03-15 09:00:00+07',
    '2026-03-15 12:00:00+07',
    'upcoming',
    v_creator_id
  );

  -- 2. Sự kiện sắp tới (upcoming)
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Workshop: Kỹ năng nghiên cứu tài liệu',
    'Hướng dẫn sinh viên cách tìm kiếm, đánh giá và sử dụng tài liệu học thuật hiệu quả. Phù hợp cho sinh viên năm nhất và năm hai.',
    'Phòng Lab máy tính - Tòa nhà B, Tầng 2',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800',
    30,
    '2026-03-20 14:00:00+07',
    '2026-03-20 17:00:00+07',
    'upcoming',
    v_creator_id
  );

  -- 3. Sự kiện sắp tới (upcoming) - không giới hạn
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Triển lãm sách cũ & Trao đổi sách',
    'Mang theo sách cũ để trao đổi với mọi người. Đây là cơ hội tuyệt vời để tìm được những cuốn sách hay mà bạn chưa từng đọc!',
    'Sảnh chính Thư viện - Tầng 1',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    NULL,
    '2026-04-05 08:00:00+07',
    '2026-04-05 17:00:00+07',
    'upcoming',
    v_creator_id
  );

  -- 4. Sự kiện đang diễn ra (ongoing)
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Cuộc thi Review Sách Hay 2026',
    'Viết review sách và có cơ hội nhận giải thưởng hấp dẫn! Cuộc thi kéo dài trong 1 tháng. Mỗi bài review được chấm điểm bởi ban giám khảo.',
    'Online - Nền tảng BookHub',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',
    100,
    '2026-02-01 00:00:00+07',
    '2026-03-01 23:59:00+07',
    'ongoing',
    v_creator_id
  );

  -- 5. Sự kiện đang diễn ra (ongoing)
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Thử thách đọc 10 cuốn sách trong 30 ngày',
    'Tham gia thử thách đọc sách để rèn luyện thói quen đọc. Hoàn thành thử thách sẽ nhận huy hiệu đặc biệt trên trang cá nhân!',
    'Online - Nền tảng BookHub',
    'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800',
    200,
    '2026-02-15 00:00:00+07',
    '2026-03-15 23:59:00+07',
    'ongoing',
    v_creator_id
  );

  -- 6. Sự kiện đã kết thúc (completed)
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Tọa đàm: Tác giả Nguyễn Nhật Ánh giao lưu',
    'Buổi giao lưu đặc biệt với tác giả Nguyễn Nhật Ánh nhân dịp ra mắt sách mới. Đã thu hút hơn 200 người tham gia.',
    'Hội trường lớn - Tòa nhà A, Tầng 5',
    'https://images.unsplash.com/photo-1529007196863-d07650a3f0ea?w=800',
    200,
    '2026-01-10 09:00:00+07',
    '2026-01-10 11:30:00+07',
    'completed',
    v_creator_id
  );

  -- 7. Sự kiện đã kết thúc (completed)
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Ngày hội Sách & Văn hóa đọc 2025',
    'Ngày hội thường niên với nhiều hoạt động: triển lãm, talkshow, workshop và giảm giá sách. Sự kiện đã thành công tốt đẹp!',
    'Khuôn viên Thư viện Trung tâm',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800',
    500,
    '2025-12-20 08:00:00+07',
    '2025-12-20 18:00:00+07',
    'completed',
    v_creator_id
  );

  -- 8. Sự kiện đã hủy (cancelled)
  INSERT INTO public.events (title, description, location, banner_url, max_participants, start_time, end_time, status, created_by)
  VALUES (
    'Picnic đọc sách ngoài trời',
    'Sự kiện đọc sách ngoài trời tại công viên. (Đã hủy do thời tiết xấu)',
    'Công viên Gia Định',
    'https://images.unsplash.com/photo-1476234251651-f353703a034d?w=800',
    40,
    '2026-02-22 08:00:00+07',
    '2026-02-22 12:00:00+07',
    'cancelled',
    v_creator_id
  );

  -- ================================
  -- INSERT EVENT REGISTRATIONS
  -- ================================

  -- Đăng ký cho Event 1 (Hội thảo Đọc sách cùng nhau)
  IF v_user1 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (1, v_user1, 'registered');
  END IF;

  IF v_user2 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (1, v_user2, 'registered');
  END IF;

  IF v_user3 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (1, v_user3, 'registered');
  END IF;

  -- Đăng ký cho Event 2 (Workshop)
  IF v_user1 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (2, v_user1, 'registered');
  END IF;

  IF v_user2 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (2, v_user2, 'registered');
  END IF;

  -- Đăng ký cho Event 4 (Cuộc thi Review)
  IF v_user1 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (4, v_user1, 'registered');
  END IF;

  IF v_user2 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (4, v_user2, 'registered');
  END IF;

  IF v_user3 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (4, v_user3, 'registered');
  END IF;

  -- Đăng ký cho Event 5 (Thử thách đọc sách)
  IF v_user1 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (5, v_user1, 'registered');
  END IF;

  -- Đăng ký cho Event 6 (Tọa đàm - completed, nên status = attended)
  IF v_user1 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (6, v_user1, 'attended');
  END IF;

  IF v_user2 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (6, v_user2, 'attended');
  END IF;

  IF v_user3 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (6, v_user3, 'attended');
  END IF;

  -- Đăng ký cho Event 7 (Ngày hội - completed)
  IF v_user1 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (7, v_user1, 'attended');
  END IF;

  IF v_user2 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (7, v_user2, 'attended');
  END IF;

  -- Đăng ký cho Event 8 (Picnic - cancelled, nên status = cancelled)
  IF v_user1 IS NOT NULL THEN
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (8, v_user1, 'cancelled');
  END IF;

  RAISE NOTICE 'Seed data inserted successfully!';
  RAISE NOTICE 'Creator: %', v_creator_id;
  RAISE NOTICE 'User1: %', v_user1;
  RAISE NOTICE 'User2: %', v_user2;
  RAISE NOTICE 'User3: %', v_user3;
END $$;

