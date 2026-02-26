-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.book_subjects (
  book_id bigint NOT NULL,
  subject_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT book_subjects_pkey PRIMARY KEY (book_id, subject_code),
  CONSTRAINT book_subjects_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT book_subjects_subject_code_fkey FOREIGN KEY (subject_code) REFERENCES public.subjects(code)
);
CREATE TABLE public.books (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  library_id bigint NOT NULL,
  title text,
  author text,
  publisher text,
  isbn bigint,
  keyword ARRAY,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  url_img text,
  CONSTRAINT books_pkey PRIMARY KEY (id),
  CONSTRAINT books_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.library(id)
);
CREATE TABLE public.library (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  name text,
  introduction text,
  location text,
  opening_hours text,
  email text,
  CONSTRAINT library_pkey PRIMARY KEY (id)
);
CREATE TABLE public.favorite_books (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  book_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorite_books_pkey PRIMARY KEY (user_id, book_id),
  CONSTRAINT favorite_books_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT favorite_books_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
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
CREATE TABLE public.roles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subjects (
  code text NOT NULL,
  name text,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (code)
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