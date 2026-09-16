// 年度账单 Mock 数据 —— 接入真实接口时，只需替换这个对象的字段。
// 两个 demo 页面共用这一份数据。

export const USER = {
  nickname: 'Jack',
  uid: '8821 0934',
  year: 2026,

  // 01 注册 / 初遇
  registerDate: '2026.03.14',
  daysWithUs: 186,
  earlierThanPct: 72, // 比 72% 的用户更早加入

  // 02 第一笔交易
  firstTrade: {
    date: '2026.03.15',
    time: '21:47',
    pair: 'BTC / USDT',
    side: '买入',
    amount: '0.0125 BTC',
    price: '68,420',
  },

  // 03 交易额
  totalVolumeUSD: 1284530, // 累计成交额（USDT）
  totalVolumeShort: '1.28M',
  tradeCount: 342,
  activeDays: 117,
  rankTopPct: 8, // 超过 92% 的用户

  // 04 最爱币种
  favoriteCoin: 'BTC',
  favoriteCoinPct: 46,
  topCoins: [
    ['BTC', 46],
    ['ETH', 27],
    ['SOL', 12],
    ['其他', 15],
  ],

  // 05 其他小故事
  latestNight: '03:26', // 最晚一次下单
  bestDay: { date: '2026.07.09', pnl: '+3,120' },
  keyword: '长期主义',
};

export function formatMoney(n) {
  return n.toLocaleString('en-US');
}
