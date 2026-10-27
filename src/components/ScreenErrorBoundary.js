import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ScreenErrorBoundary] Caught error in ${this.props.screenName || 'Component'}:`, error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.screenName}>
              Error in {this.props.screenName || 'this screen'}
            </Text>
            <Text style={styles.message} numberOfLines={3}>
              {this.state.error?.message || String(this.state.error)}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.retryButton}
              onPress={this.handleReset}
            >
              <Text style={styles.retryButtonText}>Reload Screen</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  card: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D32F2F',
    marginBottom: 8,
  },
  screenName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  message: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#5D45DB',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
