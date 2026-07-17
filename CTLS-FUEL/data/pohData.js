/* ================================================================
   CTLS POH Data — Fuel Planner
   AeroJones CTLS (Rotax 912 ULS, AVGAS 100LL)
   ------------------------------------------------------------
   本文件集中存放所有 POH 引用数据。
   POH 修订时，仅需修改本文件即可，无需改动计算逻辑。
   暴露为 window.POH_DATA 全局变量，供 script.js 读取。
   ================================================================ */

window.POH_DATA = Object.freeze({

  /* ------------------------------------------------------------
     1) 巡航功率 → 油耗对照表
        单位：L/hr（升/小时）
        数据来源：CTLS POH §2 Performance / Cruise
     ------------------------------------------------------------ */
  CRUISE_POWER: {
    '50%': { fuelBurnLph: 15.0, label: '50% (Economy)' },
    '65%': { fuelBurnLph: 18.3, label: '65% (Normal)' },
    '75%': { fuelBurnLph: 21.2, label: '75% (Fast)' }
  },

  /* ------------------------------------------------------------
     2) 巡航性能参考表（POH §2 Power Setting Chart）
        高度 × 功率 → IAS / TAS / RPM / Fuel Burn
        已知 POH 数据点：3000 / 6000 / 9000 ft
        非已知点采用线性插值；超出范围 clamp 到最近已知点
     ------------------------------------------------------------ */
  CRUISE_PERFORMANCE: Object.freeze({
    3000: Object.freeze({
      '50%': Object.freeze({ ias: 83, tas: 91,  rpm: 4200, burn: 15.0 }),
      '65%': Object.freeze({ ias: 94, tas: 103, rpm: 4600, burn: 18.3 }),
      '75%': Object.freeze({ ias: 101, tas: 110, rpm: 4900, burn: 21.2 })
    }),
    6000: Object.freeze({
      '50%': Object.freeze({ ias: 77, tas: 85,  rpm: 4050, burn: 15.0 }),
      '65%': Object.freeze({ ias: 88, tas: 97,  rpm: 4450, burn: 18.3 }),
      '75%': Object.freeze({ ias: 94, tas: 104, rpm: 4700, burn: 21.2 })
    }),
    9000: Object.freeze({
      '50%': Object.freeze({ ias: 72, tas: 79, rpm: 3850, burn: 15.0 }),
      '65%': Object.freeze({ ias: 82, tas: 90, rpm: 4250, burn: 18.3 }),
      '75%': Object.freeze({ ias: 88, tas: 96, rpm: 4500, burn: 21.2 })
    })
  }),

  /* ------------------------------------------------------------
     3) 已知高度列表（用于下拉 / 表格列头）
     ------------------------------------------------------------ */
  ALTITUDES_FT: Object.freeze([3000, 6000, 9000]),

  /* ------------------------------------------------------------
     4) 备用燃油模式
        VFR / IFR 时间来自 POH §2 Reserve Procedure
        Custom 由飞行员自行输入
     ------------------------------------------------------------ */
  RESERVE_MODE: {
    VFR:    { timeMin: 30, label: 'VFR (30 min)' },
    IFR:    { timeMin: 45, label: 'IFR (45 min)' },
    CUSTOM: { timeMin: null, label: 'Custom 自定义' }
  },

  /* ------------------------------------------------------------
     5) 慢车 / 地面运转功率油耗（POH §2 Ground Operation）
        地面运转燃油按慢车功率计算（约 15.0 L/hr）
        不随巡航功率变化
     ------------------------------------------------------------ */
  IDLE_BURN_LPH: 15.0,

  /* ------------------------------------------------------------
     6) 备用燃油使用巡航功率计算
        备用期间按相同巡航功率耗油（与 Trip 一致）
     ------------------------------------------------------------ */
  // 备用燃油 = reserveHr × cruiseBurnLph（运行时由 cruiseBurnLph 传入）

  /* ------------------------------------------------------------
     7) 物理常数
     ------------------------------------------------------------ */
  FUEL_DENSITY_KG_PER_L: 0.72,   // AVGAS 100LL
  TANK_CAPACITY_L:       80,     // CTLS 主油箱

  /* ------------------------------------------------------------
     8) 默认输入值（页面初始化）
     ------------------------------------------------------------ */
  DEFAULTS: Object.freeze({
    flightTimeHr:   2.5,         // 2:30
    taxiTimeMin:    20,          // 0:20
    altitudeFt:     6000,
    cruisePower:    '65%',
    reserveMode:    'VFR',
    reserveTimeMin: 30,          // 0:30
    fuelOnBoardL:   80
  })

});