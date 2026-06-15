<template>
  <div class="match-history-card" :class="[composedResultClass, { expanded }]" :data-game-id="game.gameId" @click="toggleExpand">
    <!-- 区域 1: 游戏信息 (112px) -->
    <div class="zone-game">
      <div class="mode" :title="formattedModeText">{{ formattedModeText }}</div>
      <div class="begin-time" :title="fullDateTime">{{ formattedRelativeTime }}</div>
      <div class="divider" />
      <div class="result">{{ formattedResultText }}</div>
      <div class="duration">{{ formattedDuration }}</div>
    </div>

    <!-- 区域 2: 玩家战绩 + 装备 -->
    <div class="zone-info">
      <div class="stats">
        <!-- 英雄头像 + 等级角标 -->
        <div class="champion">
          <ChampionIcon
            class="champion-icon"
            :champion-id="game.championId"
            :title="gds.champions[game.championId]?.name"
            :size="50"
            round
          />
          <div class="champion-level">{{ game.champLevel }}</div>
        </div>

        <!-- 召唤师技能 (2×22 竖排) -->
        <div class="summoner-spells">
          <SummonerSpellDisplay :spell-id="game.spell1Id" :size="22" />
          <SummonerSpellDisplay :spell-id="game.spell2Id" :size="22" />
        </div>

        <!-- 符文 (主系基石 + 副系风格) —— 海克斯大乱斗/竞技场无符文系统 -->
        <div v-if="showPerks" class="perks">
          <PerkDisplay :perk-id="game.perk0" :size="22" />
          <PerkstyleDisplay :perkstyle-id="game.perkSubStyle" :size="22" />
        </div>

        <!-- KDA -->
        <div class="kda-info">
          <div class="kda">
            <span class="k">{{ game.kills }}</span
            ><span class="sep">/</span
            ><span class="d">{{ game.deaths }}</span
            ><span class="sep">/</span
            ><span class="a">{{ game.assists }}</span>
          </div>
          <div class="kda-ratio" :class="{ 'perfect-kda': isPerfectKda }">
            <template v-if="game.deaths === 0 && (game.kills > 0 || game.assists > 0)">完美</template>
            <template v-else>{{ game.kdaRatio.toFixed(2) }}</template>
            KDA
          </div>
        </div>
      </div>

      <!-- 装备栏 (7 槽) -->
      <div class="items">
        <ItemDisplay :item-id="game.items[0]" :size="22" />
        <ItemDisplay :item-id="game.items[1]" :size="22" />
        <ItemDisplay :item-id="game.items[2]" :size="22" />
        <ItemDisplay :item-id="game.items[3]" :size="22" />
        <ItemDisplay :item-id="game.items[4]" :size="22" />
        <ItemDisplay :item-id="game.items[5]" :size="22" />
        <ItemDisplay :item-id="game.items[6]" :size="22" is-trinket />
      </div>
    </div>

    <!-- 区域 3: 队伍数据列 (126px) —— 对齐 LeagueAkari summary -->
    <div class="zone-stats">
      <div class="stat-row" :class="{ highlight: game.teamStats?.isHighestDamage }">
        <span class="stat-label">KP</span>
        <span class="stat-value">{{ game.teamStats?.killParticipation ?? 0 }}%</span>
      </div>
      <div class="stat-row" :class="{ highlight: game.teamStats?.isHighestDamage }">
        <span class="stat-label">DMG</span>
        <span class="stat-value">{{ game.teamStats?.damageShare ?? 0 }}%</span>
      </div>
      <div class="stat-row" :class="{ highlight: game.teamStats?.isHighestDamageTaken }">
        <span class="stat-label">Tank</span>
        <span class="stat-value">{{ game.teamStats?.damageTakenShare ?? 0 }}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Gold</span>
        <span class="stat-value">{{ game.teamStats?.goldShare ?? 0 }}%</span>
      </div>
    </div>

    <!-- 区域 4: 双方玩家 (flex:1) -->
    <div class="zone-players">
      <div class="team-col">
        <div
          v-for="p in game.blueParticipants"
          :key="p.puuid || p.participantId"
          class="player"
        >
          <LcuImage
            class="champ-img"
            :src="championIcon(p.championId)"
            :size="16"
          />
          <span
            class="name"
            :class="{ self: p.puuid === selfPuuid, clickable: p.puuid !== selfPuuid && !!p.puuid }"
            :title="displayName(p)"
            @click.stop="p.puuid && p.puuid !== selfPuuid && openPlayerTab(p)"
          >{{ displayName(p) }}</span>
        </div>
      </div>
      <div class="team-col">
        <div
          v-for="p in game.redParticipants"
          :key="p.puuid || p.participantId"
          class="player"
        >
          <LcuImage
            class="champ-img"
            :src="championIcon(p.championId)"
            :size="16"
          />
          <span
            class="name"
            :class="{ self: p.puuid === selfPuuid, clickable: p.puuid !== selfPuuid && !!p.puuid }"
            :title="displayName(p)"
            @click.stop="p.puuid && p.puuid !== selfPuuid && openPlayerTab(p)"
          >{{ displayName(p) }}</span>
        </div>
      </div>
    </div>

    <!-- 区域 5: 多选框 (40px) -->
    <div class="zone-checkbox" @click.stop>
      <n-checkbox :checked="selected" @update:checked="$emit('toggle-select')" />
    </div>

    <!-- 展开对局摘要（LeagueAkari 风格表格布局） -->
    <div v-if="expanded" class="expanded-detail" @click.stop>
      <div v-if="loadingDetail" class="detail-loading">
        <n-spin size="small" />
        <span>加载中...</span>
      </div>
      <div v-else-if="detailError" class="detail-error">
        <span>{{ detailError }}</span>
        <button class="retry-btn" @click.stop="fetchDetail()">重试</button>
      </div>
      <template v-else-if="gameRecord">
        <table class="team-table" :class="isPlayerOnBlue ? ownTeamClass : enemyTeamClass">
          <thead>
            <tr>
              <th class="col-player">{{ gameRecord.blue_team.win ? '胜' : '负' }}</th>
              <th class="col-kda">KDA</th>
              <th class="col-dmg-dealt">伤害</th>
              <th class="col-dmg-taken">承伤</th>
              <th v-if="!isKiwi" class="col-ward">视野</th>
              <th v-if="!isKiwi" class="col-cs">补刀</th>
              <th class="col-gold">金币</th>
              <th class="col-items">装备</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in gameRecord.blue_team.players"
              :key="p.puuid || p.summoner_id"
              :class="{ self: p.puuid === selfPuuid }"
            >
              <td class="col-player">
                <div class="player-identity">
                  <template v-if="isKiwi">
                    <div class="spells-col">
                      <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell1" :size="14" />
                      <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell2" :size="14" />
                    </div>
                    <div class="augments-col">
                      <AugmentDisplay v-for="(augId, aidx) in (p.stats.arena.player_augments || []).slice(0, 4)" :key="aidx" :augment-id="augId" :size="18" />
                    </div>
                  </template>
                  <ChampionIcon class="detail-champ" :champion-id="p.champion_id" :size="32" round />
                  <template v-if="!isKiwi">
                    <div class="spells-runes-stack">
                      <div class="spells-col">
                        <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell1" :size="14" />
                        <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell2" :size="14" />
                      </div>
                      <div class="runes-col">
                        <PerkDisplay :perk-id="p.stats.runes.perks[0]" :size="14" />
                        <PerkstyleDisplay :perkstyle-id="p.stats.runes.sub_style" :size="14" />
                      </div>
                    </div>
                  </template>
                  <span class="player-name" :title="p.summoner_name">{{ p.summoner_name }}</span>
                </div>
              </td>
              <td class="col-kda">
                <div class="kda-numbers">
                  <span class="k">{{ p.stats.kills }}</span>
                  <span class="sep">/</span>
                  <span class="d">{{ p.stats.deaths }}</span>
                  <span class="sep">/</span>
                  <span class="a">{{ p.stats.assists }}</span>
                </div>
                <div class="kda-sub">{{ p.stats.kda_ratio }} KDA</div>
              </td>
              <td class="col-dmg-dealt">
                <div class="dmg-value" title="对英雄伤害">{{ fmtDmg(p.stats.damage.total_to_champs) }}</div>
              </td>
              <td class="col-dmg-taken">
                <div class="dmg-value" title="承受伤害">{{ fmtDmg(p.stats.damage.total_taken) }}</div>
              </td>
              <td v-if="!isKiwi" class="col-ward">
                <div class="ward-score" title="视野得分">{{ p.stats.vision.score }}</div>
                <div class="ward-detail" title="插眼 / 排眼">{{ p.stats.vision.wards_placed }} / {{ p.stats.vision.wards_killed }}</div>
              </td>
              <td v-if="!isKiwi" class="col-cs">
                <div class="cs-total">{{ p.stats.cs.total }}</div>
                <div class="cs-min">{{ csPerMin(p.stats.cs.total) }}/min</div>
              </td>
              <td class="col-gold">
                <div class="gold-value">{{ fmtGold(p.stats.economy.gold_earned) }}</div>
              </td>
              <td class="col-items">
                <div class="items-row">
                  <ItemDisplay v-for="(it, idx) in p.stats.items" :key="idx" :item-id="it" :size="20" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="team-divider" />
        <table class="team-table" :class="isPlayerOnBlue ? enemyTeamClass : ownTeamClass">
          <thead>
            <tr>
              <th class="col-player">{{ gameRecord.red_team.win ? '胜' : '负' }}</th>
              <th class="col-kda">KDA</th>
              <th class="col-dmg-dealt">伤害</th>
              <th class="col-dmg-taken">承伤</th>
              <th v-if="!isKiwi" class="col-ward">视野</th>
              <th v-if="!isKiwi" class="col-cs">补刀</th>
              <th class="col-gold">金币</th>
              <th class="col-items">装备</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in gameRecord.red_team.players"
              :key="p.puuid || p.summoner_id"
              :class="{ self: p.puuid === selfPuuid }"
            >
              <td class="col-player">
                <div class="player-identity">
                  <template v-if="isKiwi">
                    <div class="spells-col">
                      <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell1" :size="14" />
                      <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell2" :size="14" />
                    </div>
                    <div class="augments-col">
                      <AugmentDisplay v-for="(augId, aidx) in (p.stats.arena.player_augments || []).slice(0, 4)" :key="aidx" :augment-id="augId" :size="18" />
                    </div>
                  </template>
                  <ChampionIcon class="detail-champ" :champion-id="p.champion_id" :size="32" round />
                  <template v-if="!isKiwi">
                    <div class="spells-runes-stack">
                      <div class="spells-col">
                        <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell1" :size="14" />
                        <SummonerSpellDisplay :spell-id="p.stats.summoner_spells.spell2" :size="14" />
                      </div>
                      <div class="runes-col">
                        <PerkDisplay :perk-id="p.stats.runes.perks[0]" :size="14" />
                        <PerkstyleDisplay :perkstyle-id="p.stats.runes.sub_style" :size="14" />
                      </div>
                    </div>
                  </template>
                  <span class="player-name" :title="p.summoner_name">{{ p.summoner_name }}</span>
                </div>
              </td>
              <td class="col-kda">
                <div class="kda-numbers">
                  <span class="k">{{ p.stats.kills }}</span>
                  <span class="sep">/</span>
                  <span class="d">{{ p.stats.deaths }}</span>
                  <span class="sep">/</span>
                  <span class="a">{{ p.stats.assists }}</span>
                </div>
                <div class="kda-sub">{{ p.stats.kda_ratio }} KDA</div>
              </td>
              <td class="col-dmg-dealt">
                <div class="dmg-value" title="对英雄伤害">{{ fmtDmg(p.stats.damage.total_to_champs) }}</div>
              </td>
              <td class="col-dmg-taken">
                <div class="dmg-value" title="承受伤害">{{ fmtDmg(p.stats.damage.total_taken) }}</div>
              </td>
              <td v-if="!isKiwi" class="col-ward">
                <div class="ward-score" title="视野得分">{{ p.stats.vision.score }}</div>
                <div class="ward-detail" title="插眼 / 排眼">{{ p.stats.vision.wards_placed }} / {{ p.stats.vision.wards_killed }}</div>
              </td>
              <td v-if="!isKiwi" class="col-cs">
                <div class="cs-total">{{ p.stats.cs.total }}</div>
                <div class="cs-min">{{ csPerMin(p.stats.cs.total) }}/min</div>
              </td>
              <td class="col-gold">
                <div class="gold-value">{{ fmtGold(p.stats.economy.gold_earned) }}</div>
              </td>
              <td class="col-items">
                <div class="items-row">
                  <ItemDisplay v-for="(it, idx) in p.stats.items" :key="idx" :item-id="it" :size="20" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="objectives-bar">
          <div class="obj-item">
            <span class="obj-label">塔</span>
            <span class="obj-blue">{{ gameRecord.blue_team.tower_kills }}</span>
            <span class="obj-sep">-</span>
            <span class="obj-red">{{ gameRecord.red_team.tower_kills }}</span>
          </div>
          <div class="obj-item">
            <span class="obj-label">龙</span>
            <span class="obj-blue">{{ gameRecord.blue_team.dragon_kills }}</span>
            <span class="obj-sep">-</span>
            <span class="obj-red">{{ gameRecord.red_team.dragon_kills }}</span>
          </div>
          <div class="obj-item">
            <span class="obj-label">男爵</span>
            <span class="obj-blue">{{ gameRecord.blue_team.baron_kills }}</span>
            <span class="obj-sep">-</span>
            <span class="obj-red">{{ gameRecord.red_team.baron_kills }}</span>
          </div>
          <div class="obj-item">
            <span class="obj-label">水晶</span>
            <span class="obj-blue">{{ gameRecord.blue_team.inhibitor_kills }}</span>
            <span class="obj-sep">-</span>
            <span class="obj-red">{{ gameRecord.red_team.inhibitor_kills }}</span>
          </div>
          <div class="obj-item">
            <span class="obj-label">一血</span>
            <span :class="gameRecord.blue_team.first_blood ? 'obj-hit' : 'obj-miss'">●</span>
            <span class="obj-sep">/</span>
            <span :class="gameRecord.red_team.first_blood ? 'obj-hit' : 'obj-miss'">●</span>
          </div>
          <div class="obj-item">
            <span class="obj-label">一塔</span>
            <span :class="gameRecord.blue_team.first_tower ? 'obj-hit' : 'obj-miss'">●</span>
            <span class="obj-sep">/</span>
            <span :class="gameRecord.red_team.first_tower ? 'obj-hit' : 'obj-miss'">●</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NCheckbox, NSpin } from 'naive-ui'
import { useTimeoutPoll } from '@vueuse/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { GameSummary, ParticipantBrief, GameRecord } from '@shared/types'
import { useGameDataStore } from '@/stores/game-data'
import { useTabStore } from '@/stores/tab'
import { formatGameDuration } from '@/utils/format'
import { championIcon } from '@/utils/lcu-images'
import { formatGameModeLabel, getPlayerDisplayName } from '@shared/utils/mappings'
import LcuImage from '@/components/widgets/LcuImage.vue'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import SummonerSpellDisplay from '@/components/widgets/SummonerSpellDisplay.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import PerkDisplay from '@/components/widgets/PerkDisplay.vue'
import PerkstyleDisplay from '@/components/widgets/PerkstyleDisplay.vue'
import AugmentDisplay from '@/components/widgets/AugmentDisplay.vue'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const tabStore = useTabStore()

let _lastOpenTabTime = 0

const { game, selfPuuid, selected } = defineProps<{
  game: GameSummary
  selfPuuid: string
  selected: boolean
}>()

defineEmits<{
  'toggle-select': []
}>()

const gds = useGameDataStore()

/** 每 60 秒更新相对时间 */
const formattedRelativeTime = ref('')
const fullDateTime = computed(() => {
  const ts = typeof game.gameCreation === 'string'
    ? new Date(game.gameCreation).getTime()
    : game.gameCreation
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
})

useTimeoutPoll(
  () => {
    const ts = typeof game.gameCreation === 'string'
      ? new Date(game.gameCreation).getTime()
      : game.gameCreation
    formattedRelativeTime.value = dayjs(ts).fromNow()
  },
  60000,
  { immediate: true, immediateCallback: true }
)

const formattedModeText = computed(() => formatGameModeLabel(game, gds.queues))

/** 结果文字 */
const formattedResultText = computed(() => {
  if (game.gameMode === 'PRACTICETOOL') return '-'
  return game.win ? '胜利' : '失败'
})

/** 游戏时长 */
const formattedDuration = computed(() => formatGameDuration(game.gameDuration))

/** 胜负 / 重开 class */
const composedResultClass = computed(() => {
  if (game.gameMode === 'PRACTICETOOL') return 'remake'
  return game.win ? 'win' : 'lose'
})

/** 海克斯大乱斗、斗魂竞技场等模式不需要选符文，隐藏符文区域 */
const showPerks = computed(() => {
  return game.gameMode !== 'KIWI' && game.gameMode !== 'CHERRY'
})

/** 海克斯大乱斗模式 */
const isKiwi = computed(() => game.gameMode === 'KIWI')

/** 玩家是否在蓝队 */
const isPlayerOnBlue = computed(() => game.teamId === 100)
/** 玩家队伍颜色（赢=蓝 输=红） */
const ownTeamClass = computed(() => game.win ? 'team-blue' : 'team-red')
/** 敌方队伍颜色（反色） */
const enemyTeamClass = computed(() => game.win ? 'team-red' : 'team-blue')

/** 完美 KDA（0 死且有参与击杀） */
const isPerfectKda = computed(() => {
  return game.deaths === 0 && (game.kills > 0 || game.assists > 0)
})

function displayName(p: ParticipantBrief): string {
  return getPlayerDisplayName(p)
}

function openPlayerTab(p: ParticipantBrief) {
  if (Date.now() - _lastOpenTabTime < 500) return
  _lastOpenTabTime = Date.now()
  if (!p.puuid) return
  const name = getPlayerDisplayName(p)
  if (!name) return
  tabStore.openTab(p.puuid, name, p.profileIconId, 0)
}

const expanded = ref(false)
const gameRecord = ref<GameRecord | null>(null)
const loadingDetail = ref(false)
const detailError = ref('')

async function fetchDetail() {
  loadingDetail.value = true
  detailError.value = ''
  try {
    const records = await window.lcuApi.fetchGameDetails([game.gameId])
    gameRecord.value = records[0] ?? null
    if (!records[0]) detailError.value = '未找到对局数据'
  } catch (e: unknown) {
    detailError.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loadingDetail.value = false
  }
}

function toggleExpand() {
  expanded.value = !expanded.value
  if (expanded.value && !gameRecord.value && !loadingDetail.value) {
    fetchDetail()
  }
}

function fmtGold(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k'
  if (n >= 1000) return (n / 1000).toFixed(2) + 'k'
  return String(n)
}

function fmtDmg(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k'
  if (n >= 1000) return (n / 1000).toFixed(2) + 'k'
  return String(n)
}

function csPerMin(total: number): string {
  const dur = game.gameDuration
  if (!dur || dur <= 0) return '0.0'
  return (total / (dur / 60)).toFixed(1)
}
</script>

<style lang="less" scoped>
/* ======== LeagueAkari 风格卡片布局 ======== */

.match-history-card {
  display: flex;
  flex-wrap: wrap;
  padding: 0 0 0 12px;
  border-radius: 4px;
  box-sizing: border-box;
  background-color: var(--card-base-bg);
  width: 740px;
  min-height: 96px;
  overflow: hidden;
  margin-bottom: 4px;
  cursor: pointer;

  &.expanded {
    height: auto;
    cursor: default;
  }
}

/* ======== 胜负颜色方案（对齐 LeagueAkari） ======== */
.win {
  border-left: 6px solid var(--card-win-border);
  background-color: var(--card-win-bg);
  .zone-game .mode { color: var(--card-win-text); }
  .zone-game .result { color: var(--card-win-text); }
  .zone-checkbox { background-color: var(--checkbox-win-bg); }
}

.lose {
  border-left: 6px solid var(--card-lose-border);
  background-color: var(--card-lose-bg);
  .zone-game .mode { color: var(--card-lose-text); }
  .zone-game .result { color: var(--card-lose-text); }
  .zone-checkbox { background-color: var(--checkbox-lose-bg); }
}

.remake {
  border-left: 6px solid var(--card-remake-border);
  background-color: var(--card-remake-bg);
  .zone-game .mode { color: var(--card-remake-text); }
  .zone-game .result { color: var(--card-remake-text); }
  .zone-checkbox { background-color: var(--checkbox-remake-bg); }
}

/* ======== 区域 1: 游戏信息 (112px) ======== */
.zone-game {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 112px;
  flex-shrink: 0;
  box-sizing: border-box;
  font-size: 12px;
  color: var(--card-text-secondary);
  gap: 2px;

  .mode {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    font-weight: bold;
  }

  .begin-time {
    /* 继承 zone-game 的 font-size: 12px */
  }

  .divider {
    margin: 2px 0;
    height: 1px;
    width: 60%;
    background-color: var(--card-divider);
  }

  .result {
    font-weight: bold;
  }

  .duration {
    /* 继承 zone-game 的 font-size: 12px */
  }
}

/* ======== 区域 2: 玩家战绩 + 装备 ======== */
.zone-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  width: 212px;
  flex-shrink: 0;

  .stats {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .champion {
    flex-shrink: 0;
    position: relative;
    height: 50px;
    width: 50px;
  }

  .champion-icon {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  .champion-level {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    font-size: 12px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.621);
    color: var(--text-primary);
  }

  .summoner-spells,
  .perks {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 46px;
    width: 22px;
    gap: 2px;
  }

  .kda-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100px;
    gap: 2px;

    .kda {
      display: flex;

      .k, .d, .a {
        font-weight: bold;
        font-size: 14px;
      }

      .sep {
        color: var(--card-text-secondary);
        font-size: 14px;
        margin: 0 4px;
      }

      .k { color: var(--kda-k-color); }
      .d { color: var(--kda-d-color); }
      .a { color: var(--kda-a-color); }
    }

    .kda-ratio {
      font-size: 12px;
      color: var(--card-text-secondary);
    }

    .kda-ratio.perfect-kda {
      color: var(--card-win-text);
    }
  }

  .items {
    display: flex;
    gap: 4px;
    width: min-content;
  }
}

/* ======== 区域 3: 队伍数据列 (126px) —— 对齐 LeagueAkari summary ======== */
.zone-stats {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 126px;
  flex-shrink: 0;
  padding: 10px 0;
  font-size: 11px;
  line-height: 14px;
  gap: 2px;
  color: var(--card-text-secondary);

  .stat-row {
    display: flex;
    align-items: center;
    gap: 6px;

    .stat-label {
      width: 32px;
      font-size: 11px;
      color: var(--card-text-secondary);
      text-align: right;
    }

    .stat-value {
      font-size: 11px;
      font-weight: bold;
      color: var(--card-text-primary);
    }

    &.highlight .stat-value {
      color: rgb(232, 64, 87);
    }
  }
}

/* ======== 区域 4: 双方玩家列表 ======== */
.zone-players {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px 8px 0;
  min-width: 0;

  .team-col {
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    width: 100px;
    justify-content: center;
  }

  .player {
    display: flex;
    line-height: 18px;

    .champ-img {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      margin-right: 4px;
    }

    .name {
      flex: 1;
      width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      color: var(--card-text-player);
      cursor: default;
      transition: all 0.3s ease;

      &.clickable {
        cursor: pointer;
        &:hover { color: #63e2b7; }
      }

      &.self {
        cursor: default;
        font-weight: bold;
        color: var(--text-primary);
      }
    }
  }
}

/* ======== 区域 5: 多选框 (40px) ======== */
.zone-checkbox {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
  align-items: center;
  width: 40px;
  cursor: pointer;
}

/* ======== 展开对局摘要（LeagueAkari 表格风格） ======== */
.expanded-detail {
  width: 100%;
  border-top: 1px solid var(--card-divider);
  box-sizing: border-box;
}

.detail-loading, .detail-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.detail-error {
  .retry-btn {
    background: var(--btn-bg);
    border: 1px solid var(--btn-border);
    color: var(--text-secondary);
    padding: 2px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    &:hover { color: var(--text-primary); }
  }
}

/* 队伍表格 */
.team-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;

  thead tr {
    height: 30px;
  }

  th {
    font-weight: 600;
    color: var(--text-secondary);
    text-align: left;
    padding: 4px 6px;
    white-space: nowrap;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 12px;
  }

  tbody td {
    padding: 4px 6px;
    vertical-align: middle;
    line-height: 1.3;
  }

  tbody tr {
    height: 50px;
  }

  /* 队伍蓝/红背景 —— 复用卡片自身颜色变量 */
  &.team-blue {
    tbody td { background: var(--card-win-bg); }
    thead th { color: var(--card-win-text); }
  }
  &.team-red {
    tbody td { background: var(--card-lose-bg); }
    thead th { color: var(--card-lose-text); }
  }

  /* 自我高亮 */
  tbody tr.self td {
    background: rgba(255,255,255,0.06) !important;
  }
}

/* 列宽 */
.col-player { width: 190px; }
.col-kda { width: 88px; }
.col-dmg-dealt { width: 64px; }
.col-dmg-taken { width: 64px; }
.col-ward { width: 60px; }
.col-cs { width: 56px; }
.col-gold { width: 56px; }
.col-items { width: 162px; }

/* 选手身份 */
.player-identity {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.detail-champ {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.spells-runes-stack {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.spells-col, .runes-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.augments-col {
  display: grid;
  grid-template-columns: 18px 18px;
  grid-template-rows: 18px 18px;
  gap: 2px;
  flex-shrink: 0;
}

.player-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 13px;
  min-width: 0;
}

.self .player-name {
  font-weight: 700;
}

/* KDA 列 */
.kda-numbers {
  font-weight: 700;
  font-size: 13px;
  white-space: nowrap;
  .k { color: var(--kda-k-color); }
  .d { color: var(--kda-d-color); }
  .a { color: var(--kda-a-color); }
  .sep { color: var(--card-text-secondary); font-weight: 400; margin: 0 1px; }
}

.kda-sub {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 1px;
}

/* 伤害/承伤列 */
.dmg-value {
  font-size: 12px;
  color: var(--card-text-primary);
  white-space: nowrap;
}

/* 视野列 */
.ward-score {
  font-size: 12px;
  color: var(--card-text-primary);
}
.ward-detail {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 1px;
}

/* 补刀列 */
.cs-total {
  font-size: 12px;
  color: var(--card-text-primary);
}
.cs-min {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 1px;
}

/* 金币列 */
.gold-value {
  font-size: 12px;
  color: var(--card-text-primary);
  white-space: nowrap;
}

/* 装备列 */
.items-row {
  display: flex;
  gap: 2px;
}

/* 队伍分隔线 */
.team-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 0;
}

/* 目标栏 */
.objectives-bar {
  display: flex;
  gap: 20px;
  padding: 8px 0 10px 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.obj-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.obj-label {
  color: var(--text-tertiary);
  margin-right: 2px;
}

.obj-blue { color: rgba(59,130,246,0.85); font-weight: 600; }
.obj-red { color: rgba(239,68,68,0.85); font-weight: 600; }
.obj-sep { color: var(--text-muted); }
.obj-hit { font-weight: 700; }
.obj-miss { opacity: 0.3; }
</style>
