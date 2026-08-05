import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isPremium: false,
  purchaseStatus: 'free',
  premiumFeatures: [
    'recurringTasks',
    'alarmMode',
    'photoAttachments',
    'pomodoroAccess',
    'advancedStatistics',
    'premiumThemes',
    'cloudSync'
  ]
};

const entitlementSlice = createSlice({
  name: 'entitlement',
  initialState,
  reducers: {
    setPremiumStatus: (state, action) => {
      state.isPremium = action.payload;
      state.purchaseStatus = action.payload ? 'active' : 'free';
    },
    toggleDevPremium: (state) => {
      state.isPremium = !state.isPremium;
      state.purchaseStatus = state.isPremium ? 'active' : 'free';
    }
  }
});

export const { setPremiumStatus, toggleDevPremium } = entitlementSlice.actions;

export default entitlementSlice.reducer;
