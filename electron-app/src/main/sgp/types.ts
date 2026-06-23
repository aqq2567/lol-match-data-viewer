/**
 * SGP API 原始响应类型
 * 子集 — 仅包含 match-history 相关类型（Phase 1 不需要 ranked/summoner/spectator）
 * 字段名和结构直接对应 Riot SGP API JSON
 */

/** GET /match-history-query/v1/products/lol/player/{puuid}/SUMMARY */
export interface SgpMatchHistory {
  games: SgpGame[]
}

export interface SgpGame {
  metadata: SgpGameMetadata
  json: SgpGameJson
}

export interface SgpGameMetadata {
  product: string
  tags: string[]
  participants: string[]
  timestamp: string
  data_version: string
  info_type: string
  match_id: string
  private: boolean
}

export interface SgpGameJson {
  endOfGameResult: string
  gameCreation: number
  gameDuration: number
  gameEndTimestamp: number
  gameId: number
  gameMode: string
  gameName: string
  gameStartTimestamp: number
  gameType: string
  gameVersion: string
  mapId: number
  participants: SgpParticipant[]
  platformId: string
  queueId: number
  seasonId: number
  teams: SgpTeam[]
  tournamentCode: string
}

export interface SgpTeam {
  bans: SgpBan[]
  objectives: SgpObjectives
  teamId: number
  win: boolean
}

export interface SgpBan {
  championId: number
  pickTurn: number
}

export interface SgpObjectives {
  baron: SgpObjectiveDetail
  champion: SgpObjectiveDetail
  dragon: SgpObjectiveDetail
  horde: SgpObjectiveDetail
  inhibitor: SgpObjectiveDetail
  riftHerald: SgpObjectiveDetail
  tower: SgpObjectiveDetail
}

export interface SgpObjectiveDetail {
  first: boolean
  kills: number
}

export interface SgpParticipant {
  allInPings: number
  assistMePings: number
  assists: number
  baronKills: number
  basicPings: number
  bountyLevel: number
  challenges: Record<string, number>
  champExperience: number
  champLevel: number
  championId: number
  championName: string
  championTransform: number
  commandPings: number
  consumablesPurchased: number
  damageDealtToBuildings: number
  damageDealtToObjectives: number
  damageDealtToTurrets: number
  damageSelfMitigated: number
  dangerPings: number
  deaths: number
  detectorWardsPlaced: number
  doubleKills: number
  dragonKills: number
  eligibleForProgression: boolean
  enemyMissingPings: number
  enemyVisionPings: number
  firstBloodAssist: boolean
  firstBloodKill: boolean
  firstTowerAssist: boolean
  firstTowerKill: boolean
  gameEndedInEarlySurrender: boolean
  gameEndedInSurrender: boolean
  getBackPings: number
  goldEarned: number
  goldSpent: number
  holdPings: number
  individualPosition: string
  inhibitorKills: number
  inhibitorTakedowns: number
  inhibitorsLost: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
  itemsPurchased: number
  killingSprees: number
  kills: number
  lane: string
  largestCriticalStrike: number
  largestKillingSpree: number
  largestMultiKill: number
  longestTimeSpentLiving: number
  magicDamageDealt: number
  magicDamageDealtToChampions: number
  magicDamageTaken: number
  needVisionPings: number
  neutralMinionsKilled: number
  nexusKills: number
  nexusLost: number
  nexusTakedowns: number
  objectivesStolen: number
  objectivesStolenAssists: number
  onMyWayPings: number
  participantId: number
  pentaKills: number
  perks: SgpPerks
  physicalDamageDealt: number
  physicalDamageDealtToChampions: number
  physicalDamageTaken: number
  placement: number
  playerAugment1: number
  playerAugment2: number
  playerAugment3: number
  playerAugment4: number
  playerAugment5: number
  playerAugment6: number
  playerSubteamId: number
  profileIcon: number
  pushPings: number
  puuid: string
  quadraKills: number
  riotIdGameName: string
  riotIdTagline: string
  role: string
  sightWardsBoughtInGame: number
  spell1Casts: number
  spell1Id: number
  spell2Casts: number
  spell2Id: number
  spell3Casts: number
  spell4Casts: number
  subteamPlacement: number
  summoner1Casts: number
  summoner2Casts: number
  summonerId: number
  summonerLevel: number
  summonerName: string
  teamEarlySurrendered: boolean
  teamId: number
  teamPosition: string
  timeCCingOthers: number
  timePlayed: number
  totalAllyJungleMinionsKilled: number
  totalDamageDealt: number
  totalDamageDealtToChampions: number
  totalDamageShieldedOnTeammates: number
  totalDamageTaken: number
  totalEnemyJungleMinionsKilled: number
  totalHeal: number
  totalHealsOnTeammates: number
  totalMinionsKilled: number
  totalTimeCCDealt: number
  totalTimeSpentDead: number
  totalUnitsHealed: number
  tripleKills: number
  trueDamageDealt: number
  trueDamageDealtToChampions: number
  trueDamageTaken: number
  turretKills: number
  turretTakedowns: number
  turretsLost: number
  unrealKills: number
  visionClearedPings: number
  visionScore: number
  visionWardsBoughtInGame: number
  wardsKilled: number
  wardsPlaced: number
  win: boolean
}

export interface SgpPerks {
  statPerks: SgpStatPerks
  styles: SgpPerkStyle[]
}

export interface SgpStatPerks {
  defense: number
  flex: number
  offense: number
}

export interface SgpPerkStyle {
  description: string // 'primaryStyle' | 'subStyle'
  selections: SgpPerkSelection[]
  style: number
}

export interface SgpPerkSelection {
  perk: number
  var1: number
  var2: number
  var3: number
}
