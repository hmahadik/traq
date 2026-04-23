CREATE TABLE project (
	id text PRIMARY KEY,
	worktree text NOT NULL,
	vcs text,
	name text,
	icon_url text,
	icon_color text,
	time_created integer NOT NULL,
	time_updated integer NOT NULL,
	time_initialized integer,
	sandboxes text NOT NULL,
	commands text
);

CREATE TABLE session (
	id text PRIMARY KEY,
	project_id text NOT NULL,
	parent_id text,
	slug text NOT NULL,
	directory text NOT NULL,
	title text NOT NULL,
	version text NOT NULL,
	time_created integer NOT NULL,
	time_updated integer NOT NULL
);

CREATE TABLE message (
	id text PRIMARY KEY,
	session_id text NOT NULL,
	time_created integer NOT NULL,
	time_updated integer NOT NULL,
	data text NOT NULL
);
