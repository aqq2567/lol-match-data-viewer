<template>
  <div class="match-history-card" :class="composedResultClass">
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

        <!-- 符文 (主系基石 + 副系风格) -->
        <div class="perks">
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
            :src="`/lol-game-data/assets/v1/champion-icons/${p.championId}.png`"
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
            :src="`/lol-game-data/assets/v1/champion-icons/${p.championId}.png`"
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
    <div class="zone-checkbox">
      <n-checkbox :checked="selected" @update:checked="$emit('toggle-select')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NCheckbox } from 'naive-ui'
import { useTimeoutPoll } from '@vueuse/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { GameSummary, ParticipantBrief } from '@shared/types'
import { useGameDataStore } from '@/stores/game-data'
import { useTabStore } from '@/stores/tab'
import { formatGameDuration } from '@/utils/format'
import { getGameModeName, getQueueName, getPlayerDisplayName } from '@shared/utils/mappings'
import LcuImage from '@/components/widgets/LcuImage.vue'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import SummonerSpellDisplay from '@/components/widgets/SummonerSpellDisplay.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import PerkDisplay from '@/components/widgets/PerkDisplay.vue'
import PerkstyleDisplay from '@/components/widgets/PerkstyleDisplay.vue'

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

/** 模式名 —— 优先使用中文映射表，其次 LCU queues 数据 */
const formattedModeText = computed(() => {
  if (game.gameMode === 'PRACTICETOOL') return '训练模式'
  // 先尝试通过 gameMode 映射
  const modeName = getGameModeName(game.gameMode)
  if (modeName !== game.gameMode) return modeName
  // 如果 gameMode 不在映射表中，尝试通过 queueId 查找
  return getQueueName(game.queueId, gds.queues)
})

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
  const name = p.gameName ? (p.tagLine ? `${p.gameName}#${p.tagLine}` : p.gameName) : p.summonerName
  if (!name) return
  tabStore.openTab(p.puuid, name, p.profileIconId, 0)
}
</script>

<style lang="less" scoped>
/* ======== LeagueAkari 风格卡片布局 ======== */

.match-history-card {
  display: flex;
  padding: 0 0 0 12px;
  border-radius: 4px;
  box-sizing: border-box;
  background-color: var(--card-base-bg);
  width: 740px;
  height: 96px;
  overflow: hidden;
  margin-bottom: 4px;
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
</style>
