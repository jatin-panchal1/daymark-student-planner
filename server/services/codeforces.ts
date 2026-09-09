/**
 * Codeforces API service — uses the official REST API.
 * Documentation: https://codeforces.com/apiHelp
 */

const CF_API = "https://codeforces.com/api";

async function cfRequest<T>(method: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${CF_API}/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Codeforces API error: ${response.status}`);

  const data = await response.json();
  if (data.status !== "OK") throw new Error(data.comment || "Codeforces API returned non-OK status");
  return data.result;
}

export type CodeforcesUserInfo = {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string;
  maxRank: string;
  avatar: string;
  contribution: number;
  friendOfCount: number;
  registrationTimeSeconds: number;
};

export async function getUserInfo(handle: string): Promise<CodeforcesUserInfo> {
  const result = await cfRequest<any[]>("user.info", { handles: handle });
  const user = result[0];
  if (!user) throw new Error(`Codeforces user "${handle}" not found`);
  return {
    handle: user.handle,
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    rank: user.rank || "unrated",
    maxRank: user.maxRank || "unrated",
    avatar: user.titlePhoto || user.avatar || "",
    contribution: user.contribution || 0,
    friendOfCount: user.friendOfCount || 0,
    registrationTimeSeconds: user.registrationTimeSeconds || 0,
  };
}

export type CodeforcesSubmission = {
  id: number;
  problemName: string;
  problemRating: number;
  verdict: string;
  language: string;
  timestamp: number;
  contestId: number;
  problemIndex: string;
};

export async function getRecentSubmissions(handle: string, count = 20): Promise<CodeforcesSubmission[]> {
  const result = await cfRequest<any[]>("user.status", { handle, from: "1", count: String(count) });
  return result.map((s: any) => ({
    id: s.id,
    problemName: s.problem?.name || "Unknown",
    problemRating: s.problem?.rating || 0,
    verdict: s.verdict || "UNKNOWN",
    language: s.programmingLanguage || "",
    timestamp: s.creationTimeSeconds || 0,
    contestId: s.contestId || 0,
    problemIndex: s.problem?.index || "",
  }));
}

export async function getSolvedCount(handle: string): Promise<{ total: number; byRating: Record<number, number> }> {
  // Fetch a larger set of submissions to count unique accepted problems
  const result = await cfRequest<any[]>("user.status", { handle, from: "1", count: "10000" });
  const accepted = new Set<string>();
  const byRating: Record<number, number> = {};

  for (const s of result) {
    if (s.verdict === "OK") {
      const key = `${s.problem?.contestId}-${s.problem?.index}`;
      if (!accepted.has(key)) {
        accepted.add(key);
        const rating = s.problem?.rating || 0;
        if (rating > 0) {
          byRating[rating] = (byRating[rating] || 0) + 1;
        }
      }
    }
  }

  return { total: accepted.size, byRating };
}

export type CodeforcesRatingChange = {
  contestId: number;
  contestName: string;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingChange: number;
  timestamp: number;
};

export async function getRatingHistory(handle: string): Promise<CodeforcesRatingChange[]> {
  const result = await cfRequest<any[]>("user.rating", { handle });
  return result.map((r: any) => ({
    contestId: r.contestId,
    contestName: r.contestName,
    rank: r.rank,
    oldRating: r.oldRating,
    newRating: r.newRating,
    ratingChange: r.newRating - r.oldRating,
    timestamp: r.ratingUpdateTimeSeconds,
  }));
}

export type CodeforcesContest = {
  id: number;
  name: string;
  type: string;
  phase: string;
  startTimeSeconds: number;
  durationSeconds: number;
};

export async function getUpcomingContests(): Promise<CodeforcesContest[]> {
  const result = await cfRequest<any[]>("contest.list", { gym: "false" });
  return result
    .filter((c: any) => c.phase === "BEFORE")
    .sort((a: any, b: any) => a.startTimeSeconds - b.startTimeSeconds)
    .slice(0, 10)
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      phase: c.phase,
      startTimeSeconds: c.startTimeSeconds,
      durationSeconds: c.durationSeconds,
    }));
}

export type CodeforcesFullData = {
  userInfo: CodeforcesUserInfo;
  solvedCount: { total: number; byRating: Record<number, number> };
  submissions: CodeforcesSubmission[];
  ratingHistory: CodeforcesRatingChange[];
  upcomingContests: CodeforcesContest[];
};

export async function getFullCodeforcesData(handle: string): Promise<CodeforcesFullData> {
  const [userInfo, solvedCount, submissions, ratingHistory, upcomingContests] = await Promise.all([
    getUserInfo(handle),
    getSolvedCount(handle),
    getRecentSubmissions(handle),
    getRatingHistory(handle).catch(() => []),
    getUpcomingContests().catch(() => []),
  ]);
  return { userInfo, solvedCount, submissions, ratingHistory, upcomingContests };
}
