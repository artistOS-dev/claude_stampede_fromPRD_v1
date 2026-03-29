-- ============================================================
-- Stampede — Seed Data
-- seed.sql
-- Run this AFTER 001_initial_schema.sql
-- ============================================================

-- 6 sample Circles representing different country music communities
insert into public.circles (name, description, core_artists, personality_tags, member_count, avg_song_rating) values
  (
    'Outlaw Radio',
    'For fans of the classic outlaw sound — Waylon, Willie, and beyond.',
    ARRAY['Waylon Jennings', 'Willie Nelson', 'Kris Kristofferson'],
    ARRAY['traditionalist', 'loyalist'],
    1243,
    4.7
  ),
  (
    'New Boot Goofin',
    'The latest in new country and crossover hits. Always first to the party.',
    ARRAY['Morgan Wallen', 'Luke Combs', 'Zach Bryan'],
    ARRAY['trailblazer', 'explorer'],
    3891,
    4.5
  ),
  (
    'Porch Sessions',
    'Acoustic, Americana, and storytelling. Music with soul.',
    ARRAY['Tyler Childers', 'Sturgill Simpson', 'Cody Jinks'],
    ARRAY['storyteller', 'melodist'],
    892,
    4.8
  ),
  (
    'Stadium Country',
    'Big stages, big anthems. Country at its most epic.',
    ARRAY['Garth Brooks', 'Blake Shelton', 'Keith Urban'],
    ARRAY['community', 'superfan'],
    5102,
    4.4
  ),
  (
    'Young Bucks Rising',
    'Discover the next generation of country artists before they blow up.',
    ARRAY['Lainey Wilson', 'Bailey Zimmerman', 'Jelly Roll'],
    ARRAY['trailblazer', 'explorer'],
    2218,
    4.6
  ),
  (
    'Honky Tonk Heart',
    'Traditional country for people who believe in the twang.',
    ARRAY['Chris Stapleton', 'Brandy Clark', 'Margo Price'],
    ARRAY['traditionalist', 'storyteller'],
    1567,
    4.9
  );
