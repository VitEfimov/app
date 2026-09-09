import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, registerUser, continueAsGuest } from '../features/userSlice';
import { useTheme } from '../styles/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.userReducer);
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    const loadRememberedUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('rememberedUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.email) setEmail(parsed.email);
          if (parsed.rememberMe !== undefined) setRememberMe(parsed.rememberMe);
        }
      } catch (e) {
        // Silently catch
      }
    };
    loadRememberedUser();
  }, []);

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) return;
    if (isLogin) {
      dispatch(loginUser({ email: email.trim(), password, rememberMe }));
    } else {
      dispatch(registerUser({ email: email.trim(), password }));
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgMain,
      justifyContent: 'center',
      padding: 20,
    },
    formContainer: {
      backgroundColor: colors.bgCard,
      padding: 25,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 20,
      textAlign: 'center',
    },
    errorText: {
      color: colors.danger || '#EF4444',
      marginBottom: 15,
      textAlign: 'center',
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.surfaceContainer,
      color: colors.textPrimary,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: 10,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: colors.surfaceContainerHigh,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 4,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: rememberMe ? colors.primary : 'transparent',
    },
    checkboxTick: {
      color: colors.textInverse || '#FFF',
      fontSize: 14,
      fontWeight: 'bold',
    },
    checkboxLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 15,
    },
    primaryButtonText: {
      color: colors.textInverse || '#FFF',
      fontWeight: 'bold',
      fontSize: 16,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderColor,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 20,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontWeight: 'bold',
      fontSize: 16,
    },
    toggleText: {
      color: colors.primary,
      textAlign: 'center',
      marginTop: 10,
      fontWeight: '600',
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.formContainer}>
        <Text style={styles.title}>{isLogin ? t('Login to TaskManager') || 'Login to TaskManager' : t('Register Account') || 'Register Account'}</Text>
        
        {error ? <Text style={styles.errorText}>{typeof error === 'string' ? error : JSON.stringify(error)}</Text> : null}

        <TextInput
          testID="login_email_input"
          style={styles.input}
          placeholder={t('Email') || 'Email'}
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          testID="login_password_input"
          style={styles.input}
          placeholder={t('Password') || 'Password'}
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {isLogin && (
          <TouchableOpacity 
            testID="remember_me_checkbox"
            style={styles.checkboxContainer} 
            activeOpacity={0.7}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={styles.checkbox}>
              {rememberMe && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{t('Remember Me') || 'Remember Me'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          testID="login_submit_btn"
          style={styles.primaryButton} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse || '#FFF'} />
          ) : (
            <Text style={styles.primaryButtonText}>{isLogin ? t('Login') || 'Login' : t('Register') || 'Register'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          testID="guest_login_btn"
          style={styles.secondaryButton} 
          onPress={() => dispatch(continueAsGuest())}
        >
          <Text style={styles.secondaryButtonText}>{t('Continue without login') || 'Continue without login'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.toggleText}>
            {isLogin ? t("Don't have an account? Register") || "Don't have an account? Register" : t("Already have an account? Login") || "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
