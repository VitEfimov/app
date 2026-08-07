import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    hydrateEntitlementState: (state, action) => {
      return { ...state, ...action.payload };
    },
    setPremiumStatus: (state, action) => {
      state.isPremium = action.payload;
      state.purchaseStatus = action.payload ? 'active' : 'free';
      AsyncStorage.setItem('entitlement', JSON.stringify(state));
    },
    toggleDevPremium: (state) => {
      state.isPremium = !state.isPremium;
      state.purchaseStatus = state.isPremium ? 'active' : 'free';
      AsyncStorage.setItem('entitlement', JSON.stringify(state));
    }
  }
});

export const { setPremiumStatus, toggleDevPremium, hydrateEntitlementState } = entitlementSlice.actions;

export default entitlementSlice.reducer;
