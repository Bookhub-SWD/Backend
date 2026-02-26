-- WARNING: This schema is for context and AI reference.
-- This file documents the Supabase database structure for the Bookhub project.

-- ==========================================
-- TABLES
-- ==========================================

CREATE TABLE public.library (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  name text,
  introduction text,
  location text,
  opening_hours text,
  email text,
  CONSTRAINT library_pkey PRIMARY KEY (id)
);

CREATE TABLE public.roles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT auth.uid(),
  role_id bigint NOT NULL,
  email text NOT NULL,
  full_name text,
  identity_code character varying,
  phone character varying,
  address character varying,
  status character varying,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.subjects (
  code text NOT NULL,
  name text,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (code)
);

CREATE TABLE public.books (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  library_id bigint NOT NULL,
  title text,
  author text,
  publisher text,
  isbn bigint,
  keyword text[], -- Store keywords for searching
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  url_img text,
  CONSTRAINT books_pkey PRIMARY KEY (id),
  CONSTRAINT books_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.library(id)
);

CREATE TABLE public.book_copies (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  book_id bigint NOT NULL,
  barcode text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'available'::text, -- available, borrowed, reserved, lost
  condition text, -- new, good, worn, damaged
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT book_copies_pkey PRIMARY KEY (id),
  CONSTRAINT book_copies_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);

CREATE TABLE public.book_subjects (
  book_id bigint NOT NULL,
  subject_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT book_subjects_pkey PRIMARY KEY (book_id, subject_code),
  CONSTRAINT book_subjects_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_subjects_subject_code_fkey FOREIGN KEY (subject_code) REFERENCES public.subjects(code)
);

CREATE TABLE public.favorite_books (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  book_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorite_books_pkey PRIMARY KEY (user_id, book_id),
  CONSTRAINT favorite_books_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT favorite_books_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);

CREATE TABLE public.posts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  book_id bigint NOT NULL,
  content text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'published', 
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT posts_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);

CREATE TABLE public.comments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  post_id bigint NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  parent_id bigint, 
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE,
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE
);

CREATE TABLE public.post_likes (
  post_id bigint NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE,
  CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.borrow_records (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  copy_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'requested'::text, -- requested, borrowed, returned, overdue, cancelled
  request_code text NOT NULL UNIQUE,
  request_date timestamp with time zone NOT NULL DEFAULT now(),
  borrow_date timestamp with time zone,
  due_date timestamp with time zone,
  return_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT borrow_records_pkey PRIMARY KEY (id),
  CONSTRAINT borrow_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT borrow_records_copy_id_fkey FOREIGN KEY (copy_id) REFERENCES public.book_copies(id)
);

CREATE TABLE public.reservations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  book_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'waiting'::text, -- waiting, notified, fulfilled, cancelled
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notified_at timestamp with time zone,
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.reviews (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  book_id bigint NOT NULL,
  content text NOT NULL,
  score bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT reviews_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);

-- ==========================================
-- RPC FUNCTIONS (Stored Procedures)
-- ==========================================

-- Search book IDs by keyword (Case-insensitive partial match on the keyword array)
DROP FUNCTION IF EXISTS get_book_ids_by_keyword(text);
CREATE OR REPLACE FUNCTION get_book_ids_by_keyword(search_term text)
RETURNS TABLE(id bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT b.id 
  FROM books b
  WHERE array_to_string(b.keyword, ' ') ILIKE '%' || search_term || '%';
END;
$$ LANGUAGE plpgsql;
