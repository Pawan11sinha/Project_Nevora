SET session_replication_role = replica;
--
-- PostgreSQL database dump
--

-- \restrict jiERli2Yca8PwodqxrOXEXYQzeAdTMftIFnmWZ6shqcsBinodLODQeTJvhM9ppP

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: marker; Type: TABLE DATA; Schema: level2_probe; Owner: postgres
--

INSERT INTO "level2_probe"."marker" ("id", "label") VALUES
	(1, 'level2 sample');


--
-- PostgreSQL database dump complete
--

-- \unrestrict jiERli2Yca8PwodqxrOXEXYQzeAdTMftIFnmWZ6shqcsBinodLODQeTJvhM9ppP

RESET ALL;
