-- ==========================================
-- SQL Script: Mock Overdue Fines (Randomized Weekly Distribution)
-- Purpose: Generate 200 overdue return records and fines for testing
-- Distribution: Spread across Monday to Sunday with varied daily frequency
-- User ID: 51ced4d8-d185-412f-9b2c-434184f67d08
-- Book IDs: 1 to 200
-- ==========================================

DO $$
DECLARE
    target_user_id uuid := '51ced4d8-d185-412f-9b2c-434184f67d08';
    b_id bigint;
    c_id bigint;
    r_id bigint;
    v_request_code text;
    v_barcode text;
    v_lib_id bigint;
    
    -- Date distribution variables
    v_start_of_week timestamp with time zone;
    v_day_offset int;
    v_random_return_date timestamp with time zone;
    v_overdue_days int;
    v_due_date timestamp with time zone;
    v_borrow_date timestamp with time zone;
    v_fine_amount numeric;
BEGIN
    -- 1. Check if user exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'User ID % not found in public.users table.', target_user_id;
    END IF;

    -- 2. Setup Base Week (Start from last Monday)
    -- date_trunc('week', now()) gives Monday of current week
    v_start_of_week := date_trunc('week', now());

    -- 3. Get a library ID
    SELECT id INTO v_lib_id FROM public.library LIMIT 1;
    IF v_lib_id IS NULL THEN
        INSERT INTO public.library (name) VALUES ('Default Library') RETURNING id INTO v_lib_id;
    END IF;

    -- 4. Loop through book IDs 1 to 200
    FOR b_id IN 1..200 LOOP
        -- Skip books that don't exist
        IF NOT EXISTS (SELECT 1 FROM public.books WHERE id = b_id) THEN
            CONTINUE; 
        END IF;

        -- Find or create a copy
        SELECT id INTO c_id FROM public.book_copies WHERE book_id = b_id LIMIT 1;
        IF c_id IS NULL THEN
            v_barcode := 'MOCK-SCAN-' || b_id || '-' || floor(random()*9999)::text;
            INSERT INTO public.book_copies (book_id, barcode, status)
            VALUES (b_id, v_barcode, 'available')
            RETURNING id INTO c_id;
        END IF;

        -- Prepare unique request_code
        v_request_code := UPPER(substring(md5(random()::text) from 1 for 8));

        -- 5. Calculate Randomized Dates
        -- v_day_offset: 0=Mon, 1=Tue, ..., 6=Sun
        -- We introduce bias so some days have more (using a simple weight)
        v_day_offset := floor(random() * 7);
        
        -- To make it "dynamic" as requested (some days more, some less), 
        -- we can adjust the distribution if needed, but random * 7 is already jagged.
        -- Let's add specific bias for Mon (0) and Sat (5) to be busier.
        IF (random() < 0.2) THEN v_day_offset := 0; END IF; -- 20% bias to Monday
        IF (random() < 0.15) THEN v_day_offset := 5; END IF; -- 15% bias to Saturday

        v_random_return_date := v_start_of_week + (v_day_offset * interval '1 day') + (random() * interval '8 hours' + interval '9 hours'); -- Random time between 9AM and 5PM
        
        -- All return dates must be in the past to be "waiting for fine payment"
        IF v_random_return_date > now() THEN
            v_random_return_date := v_random_return_date - interval '7 days'; -- Push back one week if in the future
        END IF;

        -- v_overdue_days: between 2 and 15 days late
        v_overdue_days := floor(random() * 14 + 2);
        v_due_date := v_random_return_date - (v_overdue_days * interval '1 day');
        v_borrow_date := v_due_date - (floor(random() * 10 + 7) * interval '1 day'); -- Borrowed 7-17 days before due date
        
        v_fine_amount := v_overdue_days * 5000;

        -- INSERT Borrow Record
        INSERT INTO public.borrow_records (
            user_id, 
            copy_id, 
            status, 
            request_code, 
            request_date, 
            borrow_date, 
            due_date, 
            return_date,
            created_at
        ) VALUES (
            target_user_id,
            c_id,
            'returned',
            v_request_code,
            v_borrow_date - interval '1 day',
            v_borrow_date,
            v_due_date,
            v_random_return_date,
            v_borrow_date
        ) RETURNING id INTO r_id;

        -- INSERT Fine Record
        INSERT INTO public.fines (
            borrow_record_id,
            user_id,
            amount,
            status,
            created_at
        ) VALUES (
            r_id,
            target_user_id,
            v_fine_amount,
            'pending',
            v_random_return_date
        );

        -- Final Step: Reset copy status
        UPDATE public.book_copies SET status = 'available' WHERE id = c_id;

    END LOOP;

    RAISE NOTICE 'MOCK SUCCESS: Created varied overdue records and fines for books 1-200 across a week.';
END $$;
