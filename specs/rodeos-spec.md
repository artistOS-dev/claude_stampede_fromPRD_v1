# Stampede — Rodeos Product Spec

## Overview

Rodeos are competitive events where Circles and artists put their music on the line.
They are the economic and cultural engine of Stampede — turning fan belief into
transparent, fan-driven competition with real prize pools and permanent history.

---

## Core Concepts

### What Is a Rodeo?
A Rodeo is a structured music competition hosted on Stampede. Circles nominate
songs from their artists, fans vote, credits flow to winners, and every outcome is
permanently archived into the Circle's history.

### Rodeo Types
| Type | Description |
|---|---|
| **Circle-vs-Circle Showdown** | Two Circles go head-to-head with equal buy-ins and shared prize pool |
| **Whale** | High-stakes event featuring top-rated artists and large prize pools |
| **Grassroots** | Emerging talent competitions with smaller stakes |
| **Artist-vs-Artist** | Artist-initiated direct matchup with a matched prize pool |

---

## Data Models

### Rodeo
```
Rodeo {
  id
  type: SHOWDOWN | WHALE | GRASSROOTS | ARTIST_VS_ARTIST
  status: PENDING | OPEN | VOTING | CLOSED | ARCHIVED
  title
  description
  startDate
  endDate
  prizePool: CreditPool
  entries: RodeoEntry[]
  votes: RodeoVote[]
  result: RodeoResult
  leagueId (optional)
  createdBy: userId | circleId
  archivedAt
}
```

### RodeoEntry
```
RodeoEntry {
  id
  rodeoId
  circleId (or artistId for Artist-vs-Artist)
  songs: Song[]           // fixed number, locked once confirmed
  internalVotePassed: boolean
  creditsContributed: number
  status: PENDING | CONFIRMED | WITHDRAWN
}
```

### RodeoVote
```
RodeoVote {
  id
  rodeoId
  voterId: userId
  songId
  targetEntryId
  voterType: CIRCLE_MEMBER | GENERAL_PUBLIC
  weight: number          // Circle members carry more weight
  createdAt
}
```

### CreditPool
```
CreditPool {
  id
  rodeoId
  sponsorCredits: number
  circleCredits: number
  artistCredits: number
  userBackedCredits: number
  total: number
  platformFee: number     // Stampede platform percentage
  distributionRules: DistributionRule[]
}
```

### DistributionRule
```
DistributionRule {
  recipient: WINNING_ARTIST | SONGWRITER | BAND | YOUNG_BUCKS | CORE_ARTISTS | USERS
  percentage: number
}
// Default split example:
// 45% → winning song artist + songwriter + band
// 45% → core artists + young bucks
// 10% → participating users
```

### RodeoResult
```
RodeoResult {
  id
  rodeoId
  winnerId: circleId | artistId
  songResults: SongResult[]
  creditDistribution: CreditDistribution[]
  voteBreakdown: {
    circleMemberVotes: number
    generalPublicVotes: number
  }
  archivedToCircleHistory: boolean
  finalizedAt
}
```

---

## Workflows

### 1. Circle-vs-Circle Showdown

**Step 1 — Challenge Initiation**
- A Circle producer or superfan board member initiates a challenge
- They search and select a target Circle (by sound profile, tier, or recent rodeo activity)
- They provide a short justification: "Why this matchup? What's the storyline?"

**Step 2 — Song Selection**
- The challenging Circle selects songs from its roster
- Fixed number of songs (defined per rodeo tier)
- Songs are labeled: studio vs. live
- Songs are locked once the internal vote passes

**Step 3 — Internal Confidence Check**
- Circle members vote internally before the challenge is sent
- Vote prompts: "Stand behind this song?" / "Would you back this with credits?"
- Must pass internal threshold to proceed

**Step 4 — Target Circle Accepts / Declines**
- Target Circle receives the challenge
- Their board reviews and votes to accept or decline
- If accepted, they field their own songs and contribute equal credits

**Step 5 — Credit Pool Assembly**
- Both Circles contribute equal credits (enforced)
- Additional credits can stack from: sponsors, artist contributions, user-backed credits
- Platform fee is deducted; remainder goes into the shared prize pool

**Step 6 — Rodeo Opens**
- Countdown timer goes live
- Subscription required to vote
- General public voters enter with granted credits ("Fresh ears welcome")

**Step 7 — Voting**
- Song-by-song voting
- Circle member votes + general public votes (separate tallies, both visible)
- No hidden weighting — radical transparency
- Live credit flow animation as votes accumulate

**Step 8 — Resolution**
- Scorecard reveal
- Winning Circle's credit pool expands
- Losing Circle retains partial credits per predefined rules
- Winners can: donate credits to artists | save for next rodeo | reinvest in another challenge

**Step 9 — Archive**
- Full rodeo locked into both Circles' timelines
- Metadata stored: songs, votes, credit flow, voter breakdown
- Contributes to artist rodeo record and Circle rodeo history

---

### 2. Young Buck Nomination (Rodeo Entry Path)

**Step 1** — A slot opens in the Young Buck ring (limited, calendar-driven)  
**Step 2** — Member nominates an artist + submits evidence (songs, story, clips)  
**Step 3** — Circle listening round created: 24–72 hour window, ratings on vocals/lyrics/instrumentation/authenticity  
**Step 4** — "Spirit of the Circle" check: "Aligns with our sound?" / "Would we back them in a rodeo?"  
**Step 5** — Board review: advance to ballot | hold for next month | archive as watchlist  
**Step 6** — Monthly vote: Circle decides on induction  
**Step 7** — If inducted: artist slides into Young Buck ring, new in-circle activity unlocked  

---

### 3. Artist-vs-Artist Rodeo

- Artist (or their team) creates a prize pool
- Opposing artist must match the pool to accept
- Fan participation and tipping supplements the pool
- Winnings flow directly to the artists
- Fans back either side with credits

---

## Artist Tiers Within Rodeos

Each Circle fields a roster across three active tiers:

| Tier | Slots | Description |
|---|---|---|
| **Core Artists** | 3 | Established, fully voted-in members |
| **Young Bucks** | 3 | Emerging artists under evaluation |
| **Rising Stars** | 3 | Artists showing momentum, nominated by members |
| **Legacy Ring** | Unlimited | Retired artists — still part of Circle history, no longer active in rodeos |

---

## Voting Rules

- **Circle member votes** carry higher weight than general public votes
- Both tallies are displayed separately (transparent)
- Rating quality is tracked per user: consistency, bias detection, pattern analysis
- Users can update ratings over time to reflect evolving opinions
- Gaming detection: Stampede monitors for coordinated or suspicious voting patterns

---

## Economy & Credit Flow

### Credit Sources
- Sponsor credits
- Circle-contributed credits
- Artist-contributed credits
- User-backed credits

### Default Distribution (Showdown)
- **45%** → Winning song's artist + songwriter + band
- **45%** → Core artists + Young Bucks of winning Circle
- **10%** → Participating users (must split donation to artists of their choice or apply to Stampede dues)

### Platform Fee
- Stampede retains a defined platform percentage from each rodeo
- Remainder enters Circle-managed funds

### Circle Funds
- Grow over time through rodeo participation
- Can be allocated or withdrawn based on predefined rules
- Circles can add to balances between rodeos

---

## Leagues

- Circles can join seasonal leagues spanning multiple rodeos
- League crowns a seasonal winner
- Circles are right-sized to ensure fair competition within leagues

---

## Rodeo UI — Key Screens

| Screen | Content |
|---|---|
| **Rodeo Feed** | All active rodeos across Stampede; filterable by tier, Circle, artist |
| **Rodeo Detail** | Songs, credit pool, live vote tallies, countdown, voter breakdown |
| **Challenge Flow** | Target selection → song selection → confidence check → credit pool |
| **Voting Screen** | Song-by-song voting; live credit animation; Circle vs public tallies |
| **Result Screen** | Scorecard reveal; credit distribution; archive confirmation |
| **Circle Rodeo History** | All past rodeos; songs, votes, outcomes, credit flow per rodeo |
| **Artist Rodeo Record** | Win/loss record; avg finishing position; prize money earned |

---

## Integration with Circles

- Every rodeo outcome is permanently archived to both participating Circles' timelines
- Rodeo performance influences artist tier movement (Young Buck → Core promotion)
- Circle rodeo record is displayed on the Circle profile
- Superfan boards propose and approve rodeo entries on behalf of their Circle
- Nomination budget per user feeds the Young Buck / Rising Star pipeline into rodeos

---

## Key Business Rules

1. Both Circles must contribute **equal credits** to enter a Showdown — no exceptions
2. Songs are **locked** once the internal vote passes — no substitutions
3. Rodeo history is **permanent** — outcomes cannot be edited or deleted
4. Artists retain control over which Circles associate their name
5. Subscription is **required** to vote in a Rodeo
6. General public voters receive **granted credits** to participate (prevents echo chambers)
7. Platform fee is deducted **before** prize pool distribution
8. User credit winnings must be **split**: portion donated to artists, portion applied to Stampede dues

---

## Open Questions / Exploratory

- Exact platform fee percentage (TBD)
- Weighting formula for Circle member vs general public votes
- Maximum rodeo duration per tier
- Rules for Circles withdrawing from a challenge after acceptance
- Fan-owned Circle investment model and revenue share mechanics
- Personality-to-taste correlation surfacing within rodeo history

---

*Last updated: April 2026 | Source: Stampede Circles + Rodeos Product Spec*
