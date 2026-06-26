/**
 * SGP API 原始响应类型
 * 子集 — 仅包含 match-history 相关类型（Phase 1 不需要 ranked/summoner/spectator）
 * 字段名和结构直接对应 Riot SGP API JSON
 */

/** GET /match-history-query/v1/products/lol/player/{puuid}/SUMMARY */
export interface SgpMatchHistory {
  games: SgpGame[]  // 对局列表（无 gameCount 字段，需分页拉到空为止）
}

export interface SgpGame {
  metadata: SgpGameMetadata  // 对局元数据（含参与者 PUUID 列表）
  json: SgpGameJson          // 对局完整数据
}

export interface SgpGameMetadata {
  product: string          // 产品标识 ("lol")
  tags: string[]           // 标签（如排位/匹配等队列类型）
  participants: string[]   // 参与者 PUUID 列表
  timestamp: string        // 对局时间戳
  data_version: string     // 数据版本号
  info_type: string        // 信息类型
  match_id: string         // 对局 ID（字符串格式）
  private: boolean         // 是否为私人对局
}

export interface SgpGameJson {
  endOfGameResult: string    // 游戏结束结果 ("GameComplete" / "Abort_Unexpected" 等)
  gameCreation: number       // 对局创建时间 (Unix 毫秒)
  gameDuration: number       // 对局持续时长 (秒)
  gameEndTimestamp: number   // 对局结束时间戳 (Unix 毫秒)
  gameId: number             // 对局 ID
  gameMode: string           // 游戏模式 ("CLASSIC" / "ARAM" / "CHERRY" 等)
  gameName: string           // 对局名称（自定义房间名）
  gameStartTimestamp: number // 对局开始时间戳 (Unix 毫秒)
  gameType: string           // 游戏类型 ("MATCHED_GAME" / "CUSTOM_GAME")
  gameVersion: string        // 游戏版本号
  mapId: number              // 地图 ID (11=召唤师峡谷, 12=嚎哭深渊, 21=斗魂竞技场)
  participants: SgpParticipant[]  // 参与者完整数据（一次拉回全部，无需二次请求）
  platformId: string         // 平台 ID
  queueId: number            // 队列 ID (420=单双排, 440=灵活, 450=大乱斗, 1750=斗魂)
  seasonId: number           // 赛季 ID
  teams: SgpTeam[]           // 队伍数据（蓝方/红方）
  tournamentCode: string     // 锦标赛代码
}

export interface SgpTeam {
  bans: SgpBan[]             // Ban 位列表
  objectives: SgpObjectives  // 队伍目标数据（大龙/小龙/塔等）
  teamId: number             // 队伍 ID (100=蓝方, 200=红方)
  win: boolean               // 是否获胜
}

export interface SgpBan {
  championId: number  // 被 Ban 英雄 ID
  pickTurn: number    // Ban 顺序 (1-10)
}

export interface SgpObjectives {
  baron: SgpObjectiveDetail        // 纳什男爵
  champion: SgpObjectiveDetail     // 英雄击杀（一血相关）
  dragon: SgpObjectiveDetail       // 巨龙
  horde: SgpObjectiveDetail        // 虚空巢虫
  inhibitor: SgpObjectiveDetail    // 水晶
  riftHerald: SgpObjectiveDetail   // 峡谷先锋
  tower: SgpObjectiveDetail        // 防御塔
}

export interface SgpObjectiveDetail {
  first: boolean  // 是否首先完成此目标
  kills: number   // 完成次数
}

/** SGP 参与者完整数据 — 约 110 字段，覆盖 LCU API 的 ~70 字段 + 40 SGP 独有字段 */
export interface SgpParticipant {
  // ═══ 基础信息 ═══
  participantId: number        // 参与者 ID (1-10)
  puuid: string                // 玩家 PUUID（全局唯一）
  summonerName: string         // 旧版召唤师名称（国际服）
  riotIdGameName: string       // Riot ID 游戏名（国服 # 号前的部分）
  riotIdTagline: string        // Riot ID 标签（国服 # 号后的部分）
  summonerId: number           // 召唤师 ID
  summonerLevel: number        // 召唤师等级
  profileIcon: number          // 头像 ID
  championId: number           // 英雄 ID
  championName: string         // 英雄英文名
  championTransform: number    // 英雄变形 (0=无, 如 Kayn 的红蓝形态)

  // ═══ 队伍与位置 ═══
  teamId: number               // 队伍 ID (100=蓝方, 200=红方)
  teamPosition: string         // 队伍位置 ("TOP" / "JUNGLE" / "MIDDLE" / "BOTTOM" / "UTILITY")
  individualPosition: string   // 个人位置 ("TOP" / "JUNGLE" / "MIDDLE" / "BOTTOM" / "UTILITY")
  lane: string                 // 路线 ("TOP" / "JUNGLE" / "MIDDLE" / "BOTTOM" / "NONE")
  role: string                 // 角色 ("DUO" / "SOLO" / "CARRY" / "SUPPORT")

  // ═══ KDA ═══
  kills: number                // 击杀
  deaths: number               // 死亡
  assists: number              // 助攻
  win: boolean                 // 胜负
  placement: number            // 排名 (1=第1名, 竞技场用)
  subteamPlacement: number     // 子队排名（斗魂竞技场 1-6）

  // ═══ 多杀 ═══
  doubleKills: number          // 双杀次数
  tripleKills: number          // 三杀次数
  quadraKills: number          // 四杀次数
  pentaKills: number           // 五杀次数
  unrealKills: number          // 六杀次数
  largestMultiKill: number     // 最大连杀数
  largestKillingSpree: number  // 最大击杀狂欢
  killingSprees: number        // 击杀狂欢次数（≥3 击杀不间隔）

  // ═══ 伤害 ═══
  totalDamageDealt: number               // 总伤害输出
  totalDamageDealtToChampions: number    // 对英雄总伤害
  totalDamageTaken: number               // 总承受伤害
  physicalDamageDealt: number            // 物理伤害输出
  physicalDamageDealtToChampions: number // 对英雄物理伤害
  physicalDamageTaken: number            // 物理承受伤害
  magicDamageDealt: number               // 魔法伤害输出
  magicDamageDealtToChampions: number    // 对英雄魔法伤害
  magicDamageTaken: number               // 魔法承受伤害
  trueDamageDealt: number                // 真实伤害输出
  trueDamageDealtToChampions: number     // 对英雄真实伤害
  trueDamageTaken: number                // 真实承受伤害
  largestCriticalStrike: number          // 最大暴击伤害
  damageSelfMitigated: number            // 自我减伤
  damageDealtToBuildings: number         // 对建筑物伤害
  damageDealtToObjectives: number        // 对目标伤害
  damageDealtToTurrets: number           // 对防御塔伤害

  // ═══ 经济 ═══
  goldEarned: number           // 获得金币
  goldSpent: number            // 花费金币

  // ═══ 补刀 ═══
  totalMinionsKilled: number               // 总补刀
  neutralMinionsKilled: number             // 野怪补刀
  totalEnemyJungleMinionsKilled: number    // 敌方野区野怪击杀（反野）
  totalAllyJungleMinionsKilled: number     // 友方野区野怪击杀

  // ═══ 装备 ═══
  item0: number                // 装备位 0
  item1: number                // 装备位 1
  item2: number                // 装备位 2
  item3: number                // 装备位 3
  item4: number                // 装备位 4
  item5: number                // 装备位 5
  item6: number                // 装备位 6（饰品）
  itemsPurchased: number       // 【SGP 独有】购买装备次数
  consumablesPurchased: number // 【SGP 独有】购买消耗品次数（药水/饼干等）

  // ═══ 符文 ═══
  perks: SgpPerks              // 符文配置（嵌套树结构，需展平）

  // ═══ 视野 ═══
  visionScore: number           // 视野得分
  wardsPlaced: number           // 放置守卫数
  wardsKilled: number           // 摧毁守卫数
  sightWardsBoughtInGame: number    // 购买真眼数
  visionWardsBoughtInGame: number   // 购买假眼数
  detectorWardsPlaced: number       // 【SGP 独有】放置控制守卫（真眼）数

  // ═══ 目标 ═══
  turretKills: number          // 防御塔击杀
  turretTakedowns: number      // 防御塔拆除参与
  turretsLost: number          // 己方防御塔丢失
  inhibitorKills: number       // 水晶击杀
  inhibitorTakedowns: number   // 水晶拆除参与
  inhibitorsLost: number       // 己方水晶丢失
  baronKills: number           // 大龙击杀参与
  dragonKills: number          // 小龙击杀参与
  nexusKills: number           // 基地击杀
  nexusLost: number            // 己方基地丢失
  nexusTakedowns: number       // 基地拆除参与

  // ═══ 技能释放（SGP 独有）═══
  spell1Casts: number          // Q 技能释放次数
  spell2Casts: number          // W 技能释放次数
  spell3Casts: number          // E 技能释放次数
  spell4Casts: number          // R 技能释放次数
  summoner1Casts: number       // D 召唤师技能释放次数
  summoner2Casts: number       // F 召唤师技能释放次数
  spell1Id: number             // 召唤师技能1 ID（D键，如闪现/引燃）
  spell2Id: number             // 召唤师技能2 ID（F键）

  // ═══ 信号（SGP 独有 — 14 种）═══
  allInPings: number           // 正在路上+冲锋信号
  assistMePings: number        // 请求协助信号
  basicPings: number           // 基础信号
  commandPings: number         // 指令信号
  dangerPings: number          // 危险信号
  enemyMissingPings: number    // 敌人消失信号
  enemyVisionPings: number     // 发现敌方视野信号
  getBackPings: number         // 撤退信号
  holdPings: number            // 原地待命信号
  needVisionPings: number      // 请求视野信号
  onMyWayPings: number         // 正在路上信号
  pushPings: number            // 推进信号
  visionClearedPings: number   // 视野已被清除信号
  baitPings: number            // 诱饵信号

  // ═══ 团队贡献（SGP 独有）═══
  totalDamageShieldedOnTeammates: number // 为队友吸收的伤害（护盾/减伤）
  totalHealsOnTeammates: number          // 为队友治疗量
  objectivesStolen: number               // 偷龙/偷男爵成功次数
  objectivesStolenAssists: number        // 偷龙/偷男爵助攻次数

  // ═══ 时间分解（SGP 独有）═══
  totalTimeSpentDead: number   // 总死亡时间（秒）
  timePlayed: number           // 实际游戏时间（秒，不含加载/暂停）
  longestTimeSpentLiving: number // 最长连续存活时间（秒）

  // ═══ 控制技能 ═══
  timeCCingOthers: number      // 控制敌方时间（秒）
  totalTimeCCDealt: number     // 总共施加控制时长（秒）

  // ═══ 治疗与自保 ═══
  totalHeal: number            // 总治疗量
  totalUnitsHealed: number     // 治疗单位数

  // ═══ 英雄等级与经验 ═══
  champLevel: number           // 英雄等级
  champExperience: number      // 【SGP 独有】英雄经验值
  eligibleForProgression: boolean // 是否满足升级宝箱条件
  bountyLevel: number          // 【SGP 独有】赏金等级

  // ═══ 首杀/首塔 ═══
  firstBloodKill: boolean      // 一血击杀
  firstBloodAssist: boolean    // 一血助攻
  firstTowerKill: boolean      // 首塔击杀
  firstTowerAssist: boolean    // 首塔助攻

  // ═══ 投降 ═══
  gameEndedInEarlySurrender: boolean // 提前投降结束 (15分钟前)
  gameEndedInSurrender: boolean      // 投降结束
  teamEarlySurrendered: boolean      // 己方提前投降

  // ═══ 斗魂竞技场 (CHERRY) ═══
  playerSubteamId: number      // 子队 ID (1-6)
  playerAugment1: number       // 海克斯增幅 1
  playerAugment2: number       // 海克斯增幅 2
  playerAugment3: number       // 海克斯增幅 3
  playerAugment4: number       // 海克斯增幅 4
  playerAugment5: number       // 海克斯增幅 5
  playerAugment6: number       // 海克斯增幅 6
  challenges: Challenges           // 挑战数据（130+ 字段，见 Challenges 接口）
  missions: SgpMissions            // 任务/评分数据（PlayerScore0-11 + 任务统计）
}

// ═══════════════════════════════════════════════════════════════
// 挑战数据 — SGP 在每局对局中提供的 130+ 深度统计字段
// 摘自 Riot match-v5 challenges，由 SGP 以 camelCase 键名返回
// ═══════════════════════════════════════════════════════════════

export interface Challenges {
  // ── 基础战斗 ──
  abilityUses: number                     // 技能释放总次数（Q+W+E+R 合计）
  kills: number                            // （冗余）击杀数
  takedowns: number                        // 参与击杀总数（击杀+助攻）
  multikills: number                       // 多杀事件次数（双杀及以上）
  killsNearEnemyTurret: number             // 在敌方塔附近击杀
  killsUnderOwnTurret: number              // 在己方塔下击杀
  killsOnRecentlyHealedByAramPack: number  // 击杀刚吃大乱斗血包的敌人
  killsWithHelpFromEpicMonster: number     // 在史诗野怪帮助下击杀
  outnumberedKills: number                 // 以少打多击杀
  soloKills: number                        // 单杀次数
  doubleAces: number                       // 双团灭（双方同时团灭）
  flawlessAces: number                     // 完美团灭（己方无阵亡的团灭）
  acesBefore15Minutes: number              // 15分钟前团灭对方
  fullTeamTakedown: number                 // 五人都参与击杀同一目标
  killedChampTookFullTeamDamageSurvived: number  // 承受全队伤害后反杀
  killAfterHiddenWithAlly: number          // 与队友一起从隐藏状态出击击杀
  immobilizeAndKillWithAlly: number        // 定身后与队友配合击杀
  pickKillWithAlly: number                 // 与队友配合抓单击杀

  // ── 击杀连环 ──
  killingSprees: number                    // 连杀次数（≥3 击杀不间断）
  legendaryCount: number                   // 传说级表现次数（≥8 连杀）
  multiKillOneSpell: number                // 单技能多杀
  multikillsAfterAggressiveFlash: number   // 激进闪现后多杀

  // ── 伤害与输出 ──
  damagePerMinute: number                  // 每分钟伤害输出
  teamDamagePercentage: number             // 团队伤害占比（0-1）
  damageTakenOnTeamPercentage: number      // 团队承伤占比（0-1）
  highestChampionDamage?: number           // 全场最高伤害值
  tookLargeDamageSurvived: number         // 承受大量伤害后存活

  // ── 经济 ──
  goldPerMinute: number                    // 每分钟经济
  bountyGold: number                       // 赏金获得（击杀赏金/推塔/补刀奖励）

  // ── 技能精准 ──
  skillshotsHit: number                    // 非指向技能命中次数
  skillshotsDodged: number                 // 躲避非指向技能次数
  landSkillShotsEarlyGame: number          // 对线期技能命中次数
  dodgeSkillShotsSmallWindow: number       // 短时间窗口内连续躲避技能
  snowballsHit: number                     // 雪球命中次数（大乱斗）

  // ── 视野 ──
  visionScorePerMinute: number             // 每分钟视野得分
  controlWardsPlaced: number               // 控制守卫（真眼）放置
  stealthWardsPlaced: number               // 隐形守卫（假眼）放置
  wardTakedowns: number                    // 排眼次数
  wardTakedownsBefore20M: number           // 20分钟前排眼次数
  wardsGuarded: number                     // 守卫保护次数（在守卫附近击杀敌人）
  twoWardsOneSweeperCount: number          // 同时持有两假眼一扫描器的次数
  controlWardTimeCoverageInRiverOrEnemyHalf?: number // 河/敌方半区真眼覆盖率
  visionScoreAdvantageLaneOpponent?: number // 对线期视野领先

  // ── 史诗野怪 ──
  baronTakedowns: number                   // 大龙击杀参与
  dragonTakedowns: number                  // 小龙击杀参与
  teamBaronKills: number                   // 团队大龙击杀次数
  teamElderDragonKills: number             // 团队远古龙击杀次数
  teamRiftHeraldKills: number              // 团队峡谷先锋击杀次数
  riftHeraldTakedowns: number              // 峡谷先锋击杀参与
  voidMonsterKill: number                  // 虚空巢虫击杀
  scuttleCrabKills: number                 // 河道迅捷蟹击杀
  epicMonsterSteals: number                // 史诗野怪偷取（抢龙）
  epicMonsterStolenWithoutSmite: number    // 无惩戒抢龙
  epicMonsterKillsNearEnemyJungler: number // 在敌方打野附近击杀史诗野怪
  epicMonsterKillsWithin30SecondsOfSpawn: number // 史诗野怪刷新30秒内击杀
  elderDragonKillsWithOpposingSoul: number // 对方有龙魂时击杀远古龙
  elderDragonMultikills: number            // 远古龙 Buff 期间多杀
  soloBaronKills: number                   // 单杀大龙
  perfectDragonSoulsTaken: number          // 完美龙魂（己方拿全部小龙）
  initialBuffCount: number                 // 首个 Buff 被哪方拿到（初始 Buff 计数）
  initialCrabCount: number                 // 首个河蟹被哪方拿到

  // ── 防御塔 ──
  turretTakedowns: number                  // 防御塔拆除参与
  turretPlatesTaken: number                // 镀层击破次数
  firstTurretKilled: number                // 参与首塔击杀（0/1）
  firstTurretKilledTime?: number           // 首塔被摧毁时间（秒）
  takedownOnFirstTurret: number            // 参与首塔击杀（含助攻）
  quickFirstTurret: number                 // 快速首塔
  outerTurretExecutesBefore10Minutes: number // 10分钟前推掉外塔
  kTurretsDestroyedBeforePlatesFall: number // 镀层掉落前摧毁的塔数
  multiTurretRiftHeraldCount: number       // 峡谷先锋协助推多塔
  turretsTakenWithRiftHerald: number       // 峡谷先锋撞塔次数
  soloTurretsLategame?: number             // 后期单拆塔

  // ── 对线/前期 ──
  jungleCsBefore10Minutes: number          // 10分钟前野怪补刀
  laneMinionsFirst10Minutes: number        // 前10分钟线上补刀
  earlyLaningPhaseGoldExpAdvantage?: number   // 对线期金钱经验领先
  laningPhaseGoldExpAdvantage?: number     // 对线期综合优劣势
  maxCsAdvantageOnLaneOpponent?: number    // 对线最大补刀领先
  maxLevelLeadLaneOpponent?: number        // 对线最大等级领先
  killsOnOtherLanesEarlyJungleAsLaner?: number // 作为线上选手前期去其他路击杀
  getTakedownsInAllLanesEarlyJungleAsLaner?: number // 前期各线都有参与击杀
  junglerKillsEarlyJungle?: number         // 打野前期击杀
  killsOnLanersEarlyJungleAsJungler?: number // 打野前期击杀线上选手
  junglerTakedownsNearDamagedEpicMonster: number // 打野在残血史诗野怪附近参与击杀

  // ── 特色机制 ──
  blastConeOppositeOpponentCount: number   // 爆炸果实炸到对面
  dancedWithRiftHerald: number             // 与峡谷先锋共舞（在附近击杀）
  poroExplosions: number                   // 魄罗爆炸（大乱斗雪球相关）
  saveAllyFromDeath: number                // 救下濒死队友
  knockEnemyIntoTeamAndKill: number        // 将敌人推入己方团队后击杀
  twentyMinionsIn3SecondsCount: number     // 3秒内补20刀次数
  takedownsInAlcove: number                // 在凹室（上路/下路凹室）参与击杀
  takedownsInEnemyFountain: number         // 在敌方泉水中参与击杀
  enemyChampionImmobilizations: number     // 控制敌方英雄次数
  outnumberedNexusKill: number             // 以少打多摧毁基地
  unseenRecalls: number                    // 未被发现的回城次数
  fistBumpParticipation: number            // 碰拳参与（队伍互动表情）
  teleportTakedowns?: number               // 传送后参与击杀
  hadAfkTeammate?: number                  // 有挂机队友（0/1）

  // ── 生存与韧性 ──
  kda: number                              // KDA 比率
  killParticipation: number                // 击杀参与率（0-1）
  deathsByEnemyChamps: number             // 被敌方英雄击杀次数
  survivedSingleDigitHpCount: number       // 个位数血量逃生次数
  survivedThreeImmobilizesInFight: number  // 单次战斗中被控3次后存活
  effectiveHealAndShielding: number        // 有效治疗与护盾值
  quickCleanse: number                     // 被控后快速解除（净化/水银/坩埚）
  completeSupportQuestInTime: number       // 辅助任务按时完成
  fasterSupportQuestCompletion?: number    // 比对手更快完成辅助任务
  longstTimeSpentLiving: number            // 最长连续存活时间（秒）

  // ── 偷野/反野 ──
  alliedJungleMonsterKills: number         // 己方野怪击杀
  enemyJungleMonsterKills: number          // 敌方野怪击杀（反野）
  moreEnemyJungleThanOpponent: number     // 比对方打野刷了更多敌方野区
  buffsStolen: number                      // 偷取 Buff 次数

  // ── 特殊物品 ──
  mejaisFullStackInTime: number            // 杀人书/杀人戒满层
  legendaryItemUsed: (number | number)[]   // 传说装备使用（ID 或 [ID, 时间]）

  // ── 其他 ──
  baronBuffGoldAdvantageOverThreshold?: number // 大龙 Buff 期间经济优势
  gameLength: number                       // 游戏时长（秒）
  hadOpenNexus: number                     // 曾暴露基地（0/1）
  lostAnInhibitor: number                  // 丢过水晶（0/1）
  maxKillDeficit: number                   // 最大击杀差距
  perfectGame: number                      // 完美比赛（0 死亡 0 丢塔）
  playedChampSelectPosition?: number       // 是否玩了自己选的位置
  '12AssistStreakCount': number            // 连续 12 次助攻（无击杀）
  takedownsAfterGainingLevelAdvantage: number // 等级领先后参与击杀
  takedownsBeforeJungleMinionSpawn: number // 野怪刷新前参与击杀（一级团）
  takedownsFirstXMinutes: number           // 前 X 分钟参与击杀
  InfernalScalePickup: number              // （斗魂竞技场）地狱火鳞片拾取

  // ── 时间类（可选） ──
  earliestBaron?: number                   // 最早大龙时间（秒）
  earliestDragonTakedown?: number          // 最早小龙时间（秒）
  earliestElderDragon?: number             // 最早远古龙时间（秒）
  fastestLegendary?: number                // 最快传说（秒）
  highestCrowdControlScore?: number        // 最高控制得分
  highestWardKills?: number                // 最高排眼数
  shortestTimeToAceFromFirstTakedown?: number // 从首杀到团灭最短时间（秒）
  thirdInhibitorDestroyedTime?: number     // 第三路水晶被摧毁时间（秒）
}

/** 任务/评分数据 — SGP 每局每位玩家独立统计 */
export interface SgpMissions {
  Missions_ChampionsKilled: number         // 任务：击杀英雄数
  Missions_CreepScore: number              // 任务：补刀数
  Missions_GoldFromStructuresDestroyed: number // 任务：拆塔获得金币
  Missions_GoldFromTurretPlatesTaken: number   // 任务：镀层获得金币
  Missions_HealingFromLevelObjects: number     // 任务：治疗/升级道具
  Missions_MinionsKilled: number           // 任务：小兵击杀
  Missions_TurretPlatesDestroyed: number   // 任务：镀层摧毁
  PlayerScore0: number                     // 战斗评分 0
  PlayerScore1: number                     // 评分 1
  PlayerScore2: number                     // 评分 2
  PlayerScore3: number                     // 评分 3
  PlayerScore4: number                     // 评分 4
  PlayerScore5: number                     // 评分 5
  PlayerScore6: number                     // 评分 6
  PlayerScore7: number                     // 评分 7
  PlayerScore8: number                     // 评分 8
  PlayerScore9: number                     // 评分 9
  PlayerScore10: number                    // 评分 10
  PlayerScore11: number                    // 评分 11
}

// ═══════════════════════════════════════════════════════════════
// 符文配置 — 嵌套树结构，需展平为 flat perks[] 数组
// ═══════════════════════════════════════════════════════════════
export interface SgpPerks {
  statPerks: SgpStatPerks      // 符文碎片（攻速/适应之力/抗性）
  styles: SgpPerkStyle[]       // 符文系（主系+副系，各含 4 个选择）
}

/** 符文碎片 — 固定 3 个属性 */
export interface SgpStatPerks {
  defense: number   // 抗性符文（魔抗/护甲）
  flex: number      // 灵活符文（适应之力）
  offense: number   // 攻击符文（攻速/适应之力）
}

/** 符文系 — 主系或副系 */
export interface SgpPerkStyle {
  description: string          // "primaryStyle" | "subStyle"
  selections: SgpPerkSelection[] // 该系中的符文选择（1 基石 + 3 普通）
  style: number                // 符文系 ID（如 8000=精密, 8100=主宰）
}

/** 单个符文选择 */
export interface SgpPerkSelection {
  perk: number   // 符文 ID
  var1: number   // 符文变量 1（如额外伤害值）
  var2: number   // 符文变量 2
  var3: number   // 符文变量 3
}
