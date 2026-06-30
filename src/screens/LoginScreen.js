import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, registerUser, continueAsGuest } from '../features/userSlice';
import { useTheme } from '../styles/ThemeContext';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.userReducer);
  const { colors, isDark } = useTheme();

  const handleSubmit = () => {
    if (isLogin) {
      dispatch(loginUser({ email, password, rememberMe }));
    } else {
      dispatch(registerUser({ email, password }));
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
      color: colors.danger,
      marginBottom: 15,
      textAlign: 'center',
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
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 4,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: rememberMe ? colors.primary : 'transparent',
    },
    checkboxTick: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: 'bold',
    },
    checkboxLabel: {
      color: colors.textSecondary,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 15,
    },
    primaryButtonText: {
      color: colors.textInverse,
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
        <Text style={styles.title}>{isLogin ? 'Login to TaskManager' : 'Register Account'}</Text>
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {isLogin && (
          <TouchableOpacity 
            style={styles.checkboxContainer} 
            activeOpacity={0.7}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={styles.checkbox}>
              {rememberMe && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Remember Me</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={() => dispatch(continueAsGuest())}
        >
          <Text style={styles.secondaryButtonText}>Continue without login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
