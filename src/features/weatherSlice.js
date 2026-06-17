import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice } from '@reduxjs/toolkit';

const loadFromLocalStorageWeather = () => {
  return [{ city: '', apiKey: '' }];
};

const initialState = {
  weather: loadFromLocalStorageWeather(),
  loading: false,
  error: null,
};

const weatherSlice = createSlice({
  name: 'weather',
  initialState,
  reducers: {
    hydrateWeatherState: (state, action) => {
      state.weather = action.payload;
    },
    updateWeatherCity: (state, action) => {
      state.weather[0].city = action.payload;
      AsyncStorage.setItem('weather', JSON.stringify(state.weather));
    },
    updateWeatherApi: (state, action) => {
      state.weather[0].apiKey = action.payload;
      AsyncStorage.setItem('weather', JSON.stringify(state.weather));
    },
  },
});

export const { hydrateWeatherState, updateWeatherCity, updateWeatherApi } = weatherSlice.actions;

export default weatherSlice.reducer;
