--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.users_role_enum AS ENUM (
    'user',
    'admin',
    'superadmin',
    'test'
);


ALTER TYPE public.users_role_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid NOT NULL,
    "postId" uuid NOT NULL,
    "parentId" uuid,
    likes integer DEFAULT 0 NOT NULL,
    "fileUrl" character varying,
    "fileType" character varying,
    "fileName" character varying,
    "imageUrl" character varying,
    "likedUserIds" text DEFAULT ''::text NOT NULL,
    "repliesCount" integer DEFAULT 0 NOT NULL,
    "numericId" character varying,
    slug character varying NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    "fileUrl" character varying,
    "fileType" character varying,
    "fileName" character varying,
    "likedUserIds" text DEFAULT ''::text NOT NULL,
    "repliesCount" integer DEFAULT 0 NOT NULL,
    "imageUrl" character varying,
    slug character varying NOT NULL
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: user_following; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_following (
    "userId" uuid NOT NULL,
    "followingId" uuid NOT NULL
);


ALTER TABLE public.user_following OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    "userName" character varying NOT NULL,
    "passwordHash" character varying NOT NULL,
    "avatarUrl" character varying,
    "avatarShape" character varying DEFAULT 'circle'::character varying NOT NULL,
    role public.users_role_enum DEFAULT 'user'::public.users_role_enum NOT NULL,
    slug character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: posts PK_2829ac61eff60fcec60d7274b9e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY (id);


--
-- Name: user_following PK_6cc28fa2a68c13314be6cfd86c6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_following
    ADD CONSTRAINT "PK_6cc28fa2a68c13314be6cfd86c6" PRIMARY KEY ("userId", "followingId");


--
-- Name: comments PK_8bf68bc960f2b69e818bdb90dcb; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: users UQ_226bb9aa7aa8a69991209d58f59; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_226bb9aa7aa8a69991209d58f59" UNIQUE ("userName");


--
-- Name: comments UQ_52677ce5ac41f678869b5cd33a5; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "UQ_52677ce5ac41f678869b5cd33a5" UNIQUE (slug);


--
-- Name: posts UQ_54ddf9075260407dcfdd7248577; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "UQ_54ddf9075260407dcfdd7248577" UNIQUE (slug);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: users UQ_bc0c27d77ee64f0a097a5c269b3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_bc0c27d77ee64f0a097a5c269b3" UNIQUE (slug);


--
-- Name: IDX_06680b0cdf84b1d8a690e22176; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_06680b0cdf84b1d8a690e22176" ON public.user_following USING btree ("userId");


--
-- Name: IDX_b88ad49e84034c506d3c0ae742; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_b88ad49e84034c506d3c0ae742" ON public.user_following USING btree ("followingId");


--
-- Name: user_following FK_06680b0cdf84b1d8a690e221763; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_following
    ADD CONSTRAINT "FK_06680b0cdf84b1d8a690e221763" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: comments FK_7e8d7c49f218ebb14314fdb3749; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: comments FK_8770bd9030a3d13c5f79a7d2e81; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "FK_8770bd9030a3d13c5f79a7d2e81" FOREIGN KEY ("parentId") REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: posts FK_ae05faaa55c866130abef6e1fee; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "FK_ae05faaa55c866130abef6e1fee" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: user_following FK_b88ad49e84034c506d3c0ae7422; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_following
    ADD CONSTRAINT "FK_b88ad49e84034c506d3c0ae7422" FOREIGN KEY ("followingId") REFERENCES public.users(id);


--
-- Name: comments FK_e44ddaaa6d058cb4092f83ad61f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" FOREIGN KEY ("postId") REFERENCES public.posts(id);


--
-- PostgreSQL database dump complete
--

