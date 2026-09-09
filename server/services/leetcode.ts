/**
 * LeetCode API service — uses the unofficial GraphQL endpoint.
 * All data is fetched server-side to avoid CORS issues.
 */

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

async function leetcodeQuery(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Referer": "https://leetcode.com" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`LeetCode API error: ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "LeetCode GraphQL error");
  return data.data;
}

export type LeetCodeProfile = {
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  easyTotal: number;
  mediumTotal: number;
  hardTotal: number;
  ranking: number;
  contributionPoints: number;
};

export async function getLeetCodeProfile(username: string): Promise<LeetCodeProfile> {
  const data = await leetcodeQuery(`
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile { ranking }
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
        contributions { points }
      }
      allQuestionsCount { difficulty count }
    }
  `, { username });

  const user = data.matchedUser;
  if (!user) throw new Error(`LeetCode user "${username}" not found`);

  const stats = user.submitStatsGlobal.acSubmissionNum;
  const totals = data.allQuestionsCount;
  const findCount = (arr: { difficulty: string; count: number }[], d: string) => arr.find((s: { difficulty: string }) => s.difficulty === d)?.count || 0;

  return {
    username: user.username,
    totalSolved: findCount(stats, "All"),
    easySolved: findCount(stats, "Easy"),
    mediumSolved: findCount(stats, "Medium"),
    hardSolved: findCount(stats, "Hard"),
    easyTotal: findCount(totals, "Easy"),
    mediumTotal: findCount(totals, "Medium"),
    hardTotal: findCount(totals, "Hard"),
    ranking: user.profile?.ranking || 0,
    contributionPoints: user.contributions?.points || 0,
  };
}

export type LeetCodeSubmission = {
  title: string;
  titleSlug: string;
  statusDisplay: string;
  lang: string;
  timestamp: number;
};

export async function getRecentSubmissions(username: string, limit = 20): Promise<LeetCodeSubmission[]> {
  const data = await leetcodeQuery(`
    query getRecentSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        statusDisplay
        lang
        timestamp
      }
    }
  `, { username, limit });

  return (data.recentAcSubmissionList || []).map((s: any) => ({
    title: s.title,
    titleSlug: s.titleSlug,
    statusDisplay: s.statusDisplay || "Accepted",
    lang: s.lang,
    timestamp: Number(s.timestamp),
  }));
}

export type LeetCodeContest = {
  rating: number;
  globalRanking: number;
  attendedContestsCount: number;
  history: { contestTitle: string; rating: number; ranking: number; timestamp: number }[];
};

export async function getContestInfo(username: string): Promise<LeetCodeContest> {
  const data = await leetcodeQuery(`
    query getContestRanking($username: String!) {
      userContestRanking(username: $username) {
        rating
        globalRanking
        attendedContestsCount
      }
      userContestRankingHistory(username: $username) {
        contest { title startTime }
        rating
        ranking
      }
    }
  `, { username });

  const ranking = data.userContestRanking;
  const history = (data.userContestRankingHistory || [])
    .filter((h: any) => h.rating > 0)
    .map((h: any) => ({
      contestTitle: h.contest.title,
      rating: Math.round(h.rating),
      ranking: h.ranking,
      timestamp: h.contest.startTime,
    }));

  return {
    rating: ranking ? Math.round(ranking.rating) : 0,
    globalRanking: ranking?.globalRanking || 0,
    attendedContestsCount: ranking?.attendedContestsCount || 0,
    history,
  };
}

export type LeetCodeCalendar = {
  submissionCalendar: Record<string, number>; // timestamp -> count
  streak: number;
  totalActiveDays: number;
};

export async function getSubmissionCalendar(username: string): Promise<LeetCodeCalendar> {
  const data = await leetcodeQuery(`
    query getCalendar($username: String!) {
      matchedUser(username: $username) {
        submissionCalendar
        streak
        totalActiveDays: submitStatsGlobal {
          acSubmissionNum { count difficulty }
        }
      }
    }
  `, { username });

  const user = data.matchedUser;
  let calendar: Record<string, number> = {};
  try {
    calendar = JSON.parse(user?.submissionCalendar || "{}");
  } catch { /* empty */ }

  // Compute streak from calendar
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ts = Math.floor(d.getTime() / 1000).toString();
    if (calendar[ts] && calendar[ts] > 0) {
      streak++;
    } else if (i > 0) { // Allow today to be empty
      break;
    }
  }

  return {
    submissionCalendar: calendar,
    streak: user?.streak || streak,
    totalActiveDays: Object.keys(calendar).length,
  };
}

export type LeetCodeFullData = {
  profile: LeetCodeProfile;
  submissions: LeetCodeSubmission[];
  contest: LeetCodeContest;
  calendar: LeetCodeCalendar;
};

export async function getFullLeetCodeData(username: string): Promise<LeetCodeFullData> {
  const [profile, submissions, contest, calendar] = await Promise.all([
    getLeetCodeProfile(username),
    getRecentSubmissions(username),
    getContestInfo(username).catch(() => ({ rating: 0, globalRanking: 0, attendedContestsCount: 0, history: [] })),
    getSubmissionCalendar(username).catch(() => ({ submissionCalendar: {}, streak: 0, totalActiveDays: 0 })),
  ]);
  return { profile, submissions, contest, calendar };
}
