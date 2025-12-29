import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CalculationResultCardProps {
  title: string;
  value: string;
  valueColor?: string;
  icon?: string;
}

export const CalculationResultCard: React.FC<CalculationResultCardProps> = ({
  title,
  value,
  valueColor = '#FFFFFF',
  icon,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.header}>
          {icon && (
            <>
              <Text style={styles.icon} numberOfLines={1}>
                {icon}
              </Text>
              <View style={styles.spacer} />
            </>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.spacerSmall} />
        <Text style={[styles.value, { color: valueColor }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#424242',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    color: '#BDBDBD',
  },
  spacer: {
    width: 6,
  },
  spacerSmall: {
    height: 6,
  },
  title: {
    flex: 1,
    color: '#BDBDBD',
    fontSize: 14,
  },
  value: {
    fontSize: 19,
    fontWeight: 'bold',
    lineHeight: 22.8,
  },
});

