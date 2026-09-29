dayjs.extend(dayjs_plugin_relativeTime);
dayjs.locale('zh-cn');

const GAME_CONFIG = {
  genshin: {
    name: '原神',
    nameEn: 'Genshin Impact',
    themeColor: '#4CC3F0',
    baseVersion: '6.6',
    baseDate: '2026-05-20',
    launchDate: '2020-09-28',
    cycleDays: 42,
    halfCycleDays: 21,
    previewDaysBefore: 12,
    maintenanceDay: 3,
    maintenanceStart: '06:00',
    maintenanceEnd: '11:00',
    timezone: 'Asia/Shanghai',
    specialCycles: {},
  },
  starrail: {
    name: '崩坏：星穹铁道',
    nameEn: 'Honkai: Star Rail',
    themeColor: '#F0D060',
    // 基准锚点：4.6「月升之前，与兽共舞」于 2026-09-28（周一）上线，官方公告持续至 2026-11-11
    baseVersion: '4.6',
    baseDate: '2026-09-28',
    launchDate: '2023-04-26',
    cycleDays: 42,
    halfCycleDays: 21,
    previewDaysBefore: 12,
    maintenanceDay: 3,
    maintenanceStart: '06:00',
    maintenanceEnd: '11:00',
    timezone: 'Asia/Shanghai',
    // 官方公告的实际版本时长（天）：
    // 4.3: 06-01~07-15(44)  4.4: 07-15~08-26(42)  4.5: 08-26~09-28(33，缩短)  4.6: 09-28~11-11(44)
    specialCycles: { '4.6': 44 },
  },
};

function majorBump(ver) {
  const parts = ver.split('.');
  return (parseInt(parts[0]) + 1) + '.0';
}

function minorBump(ver) {
  const parts = ver.split('.');
  return parts[0] + '.' + (parseInt(parts[1]) + 1);
}

function getCycleDaysForVersion(ver, config) {
  return config.specialCycles[ver] || config.cycleDays;
}

function isAnnivVersion(versionStartDate, versionEndDate, launchDate) {
  // 判断 [versionStartDate, versionEndDate) 区间内是否包含开服纪念日（仅比较月-日）
  const launch = dayjs(launchDate);
  const targetMonth = launch.month();
  const targetDay = launch.date();
  let cursor = dayjs(versionStartDate);
  const end = dayjs(versionEndDate);
  while (cursor.isBefore(end)) {
    if (cursor.month() === targetMonth && cursor.date() === targetDay) {
      return true;
    }
    cursor = cursor.add(1, 'day');
  }
  return false;
}

function getNextVersion(currentVer, currentVerDate, config) {
  // 站在 currentVer，决定下一版本的版本号与上线日期
  const cycle = getCycleDaysForVersion(currentVer, config);
  const nextDate = alignToWednesday(dayjs(currentVerDate).add(cycle, 'day'));
  const nextNextDate = alignToWednesday(nextDate.add(cycle, 'day'));
  const nextThirdDate = alignToWednesday(nextNextDate.add(cycle, 'day'));

  // 规则：周年庆版本 = 持续期含开服纪念日的版本；大版本 = 周年庆版本的前一个版本
  // 若下下版本是周年庆 → 下一版本是大版本 → major 进位为 X.0
  // 否则 → minor +1
  if (isAnnivVersion(nextNextDate, nextThirdDate, config.launchDate)) {
    return { version: majorBump(currentVer), date: nextDate };
  }
  return { version: minorBump(currentVer), date: nextDate };
}

function alignToWednesday(date) {
  const d = dayjs(date);
  const dow = d.day();
  if (dow === 3) return d;
  if (dow < 3) return d.add(3 - dow, 'day');
  return d.add(10 - dow, 'day');
}

function predictCurrentVersion(config) {
  const baseDate = dayjs(config.baseDate);
  const today = dayjs().startOf('day');
  let accumulated = 0;
  let currentVer = config.baseVersion;
  let verDate = baseDate;

  while (true) {
    const cycle = getCycleDaysForVersion(currentVer, config);
    if (accumulated + cycle > today.diff(baseDate, 'day')) {
      break;
    }
    accumulated += cycle;
    const next = getNextVersion(currentVer, verDate, config);
    currentVer = next.version;
    verDate = baseDate.add(accumulated, 'day');
  }

  const elapsed = today.diff(verDate, 'day');
  const cycle = getCycleDaysForVersion(currentVer, config);
  const remaining = cycle - elapsed;

  const next = getNextVersion(currentVer, verDate, config);
  const nextVer = next.version;
  const nextDate = next.date;

  const half1Start = verDate;
  const half1End = verDate.add(config.halfCycleDays, 'day');
  const half2Start = half1End;
  const half2End = verDate.add(cycle, 'day');

  const half1Elapsed = Math.max(0, today.diff(half1Start, 'day'));
  const half1Remaining = Math.max(0, half1End.diff(today, 'day'));
  const half2Elapsed = Math.max(0, today.diff(half2Start, 'day'));
  const half2Remaining = Math.max(0, half2End.diff(today, 'day'));

  // 前瞻直播通常在版本更新前约12天的周五
  const previewDate = nextDate.subtract(config.previewDaysBefore, 'day');
  const previewDow = previewDate.day();
  let adjustedPreview = previewDate;
  if (previewDow !== 5) {
    adjustedPreview = previewDate.add(5 - previewDow, 'day');
  }

  return {
    currentVersion: currentVer,
    currentVersionDate: verDate.format('YYYY-MM-DD'),
    nextVersion: nextVer,
    nextVersionDate: nextDate.format('YYYY-MM-DD'),
    nextVersionDateObj: nextDate,
    previewLiveDate: adjustedPreview.format('YYYY-MM-DD'),
    elapsed,
    remaining,
    cycleDays: cycle,
    halfCycleDays: config.halfCycleDays,
    previewDaysBefore: config.previewDaysBefore,
    maintenanceStart: config.maintenanceStart,
    maintenanceEnd: config.maintenanceEnd,
    half1Start: half1Start.format('YYYY-MM-DD'),
    half1End: half1End.format('YYYY-MM-DD'),
    half2Start: half2Start.format('YYYY-MM-DD'),
    half2End: half2End.format('YYYY-MM-DD'),
    half1Elapsed,
    half1Remaining,
    half2Elapsed,
    half2Remaining,
  };
}

function predictFutureVersions(config, currentData, count) {
  const versions = [];
  const currentVerDate = dayjs(currentData.currentVersionDate);

  versions.push({
    version: currentData.currentVersion,
    estimatedDate: currentData.currentVersionDate,
    isCurrent: true,
    confidence: 'high',
    daysFromNow: 0,
    maintenanceStart: config.maintenanceStart,
    maintenanceEnd: config.maintenanceEnd,
  });

  let ver = currentData.currentVersion;
  let prevDate = currentVerDate;

  for (let i = 0; i < count; i++) {
    const next = getNextVersion(ver, prevDate, config);
    ver = next.version;
    const nextDate = next.date;
    const daysFromNow = nextDate.diff(dayjs().startOf('day'), 'day');

    // 计算前瞻直播日期
    const previewDate = nextDate.subtract(config.previewDaysBefore, 'day');
    const previewDow = previewDate.day();
    let adjustedPreview = previewDate;
    if (previewDow !== 5) {
      adjustedPreview = previewDate.add(5 - previewDow, 'day');
    }

    let confidence = 'low';
    if (i === 0) confidence = 'high';
    else if (i === 1) confidence = 'medium';

    versions.push({
      version: ver,
      estimatedDate: nextDate.format('YYYY-MM-DD'),
      previewLiveDate: adjustedPreview.format('YYYY-MM-DD'),
      isCurrent: false,
      confidence,
      daysFromNow: Math.max(0, daysFromNow),
      maintenanceStart: config.maintenanceStart,
      maintenanceEnd: config.maintenanceEnd,
    });

    prevDate = nextDate;
  }

  return versions;
}

const { createApp, ref, computed, watch, onMounted, onUnmounted } = Vue;

createApp({
  setup() {
    const selectedGame = ref(localStorage.getItem('selectedGame') || 'genshin');
    const showAllVersions = ref(false);
    const showDetailedCountdown = ref(true);

    const games = [
      { key: 'genshin', name: '原神', themeColor: '#4CC3F0' },
      { key: 'starrail', name: '崩铁', themeColor: '#F0D060' },
    ];

    const currentGameData = computed(() => {
      const config = GAME_CONFIG[selectedGame.value];
      return predictCurrentVersion(config);
    });

    const futureVersions = computed(() => {
      const config = GAME_CONFIG[selectedGame.value];
      const allVersions = predictFutureVersions(config, currentGameData.value, 8);
      return allVersions.filter(v => !v.isCurrent);
    });

    const displayedVersions = computed(() => {
      if (showAllVersions.value) return futureVersions.value;
      return futureVersions.value.slice(0, 5);
    });

    const timelineVersions = computed(() => {
      const config = GAME_CONFIG[selectedGame.value];
      return predictFutureVersions(config, currentGameData.value, 5);
    });

    const isHalf1 = computed(() => {
      return currentGameData.value.half1Remaining > 0;
    });

    const isHalf2 = computed(() => {
      return !isHalf1.value && currentGameData.value.half2Remaining > 0;
    });

    const half1Percent = computed(() => {
      const data = currentGameData.value;
      return Math.min(100, Math.max(0, (data.half1Elapsed / data.halfCycleDays) * 100));
    });

    const half2Percent = computed(() => {
      const data = currentGameData.value;
      return Math.min(100, Math.max(0, (data.half2Elapsed / data.halfCycleDays) * 100));
    });

    const countdown = ref({ days: '00', hours: '00', minutes: '00', seconds: '00' });
    const totalDaysLeft = ref(0);
    const isCountdownZero = ref(false);
    const previewCountdown = ref({ days: '00', hours: '00', minutes: '00', seconds: '00' });
    const previewTotalDays = ref(0);
    const isPreviewPassed = ref(false);

    let timer = null;

    function updateCountdown() {
      const data = currentGameData.value;
      const target = dayjs(data.nextVersionDate + ' ' + data.maintenanceStart);
      const now = dayjs();
      const diff = target.diff(now);

      if (diff <= 0) {
        countdown.value = { days: '00', hours: '00', minutes: '00', seconds: '00' };
        totalDaysLeft.value = 0;
        isCountdownZero.value = true;
        return;
      }

      isCountdownZero.value = false;

      const totalSec = Math.floor(diff / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;

      countdown.value = {
        days: String(d).padStart(2, '0'),
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0'),
      };
      totalDaysLeft.value = d;

      // 前瞻直播倒计时
      const previewTarget = dayjs(data.previewLiveDate + ' 20:00');
      const previewDiff = previewTarget.diff(now);
      if (previewDiff <= 0) {
        previewCountdown.value = { days: '00', hours: '00', minutes: '00', seconds: '00' };
        previewTotalDays.value = 0;
        isPreviewPassed.value = true;
      } else {
        isPreviewPassed.value = false;
        const pSec = Math.floor(previewDiff / 1000);
        const pd = Math.floor(pSec / 86400);
        const ph = Math.floor((pSec % 86400) / 3600);
        const pm = Math.floor((pSec % 3600) / 60);
        const ps = pSec % 60;
        previewCountdown.value = {
          days: String(pd).padStart(2, '0'),
          hours: String(ph).padStart(2, '0'),
          minutes: String(pm).padStart(2, '0'),
          seconds: String(ps).padStart(2, '0'),
        };
        previewTotalDays.value = pd;
      }
    }

    function switchGame(key) {
      selectedGame.value = key;
    }

    function toggleCountdownFormat() {
      showDetailedCountdown.value = !showDetailedCountdown.value;
    }

    function formatVersionDate(dateStr) {
      return dayjs(dateStr).format('YYYY年M月D日');
    }

    function formatShortDate(dateStr) {
      return dayjs(dateStr).format('M/D');
    }

    function formatDaysFromNow(days) {
      if (days < 7) {
        const hours = days * 24;
        return hours + '小时';
      }
      return days + '天';
    }

    function bannerStatus(half) {
      if (half === 1) {
        return isHalf1.value ? 'active' : 'ended';
      }
      if (isHalf1.value) return 'upcoming';
      return isHalf2.value ? 'active' : 'ended';
    }

    function bannerStatusText(half) {
      if (half === 1) {
        return isHalf1.value ? '进行中' : '已结束';
      }
      if (isHalf1.value) return '即将开始';
      return isHalf2.value ? '进行中' : '已结束';
    }

    function particleStyle(n) {
      const left = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = 6 + Math.random() * 6;
      const size = 1 + Math.random() * 2;
      return {
        left: left + '%',
        bottom: '0',
        width: size + 'px',
        height: size + 'px',
        animationDelay: delay + 's',
        animationDuration: duration + 's',
      };
    }

    watch(selectedGame, (game) => {
      document.body.dataset.game = game;
      localStorage.setItem('selectedGame', game);
      updateCountdown();
    });

    onMounted(() => {
      document.body.dataset.game = selectedGame.value;
      updateCountdown();
      timer = setInterval(updateCountdown, 1000);
    });

    onUnmounted(() => {
      if (timer) clearInterval(timer);
    });

    return {
      selectedGame,
      games,
      currentGameData,
      futureVersions,
      displayedVersions,
      timelineVersions,
      showAllVersions,
      showDetailedCountdown,
      countdown,
      totalDaysLeft,
      isCountdownZero,
      previewCountdown,
      previewTotalDays,
      isPreviewPassed,
      isHalf1,
      isHalf2,
      half1Percent,
      half2Percent,
      switchGame,
      toggleCountdownFormat,
      formatVersionDate,
      formatDaysFromNow,
      formatShortDate,
      bannerStatus,
      bannerStatusText,
      particleStyle,
    };
  },
}).mount('#app');
