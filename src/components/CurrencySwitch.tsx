import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Currency } from '../models/Currency';

interface CurrencySwitchProps {
  selectedCurrency: Currency;
  onChanged: (currency: Currency) => void;
}

export const CurrencySwitch: React.FC<CurrencySwitchProps> = ({
  selectedCurrency,
  onChanged,
}) => {
  return (
    <View style={styles.container}>
      <CurrencyButton
        label="원화 (KRW)"
        currency={Currency.KRW}
        isSelected={selectedCurrency === Currency.KRW}
        onTap={() => onChanged(Currency.KRW)}
      />
      <CurrencyButton
        label="달러 (USD)"
        currency={Currency.USD}
        isSelected={selectedCurrency === Currency.USD}
        onTap={() => onChanged(Currency.USD)}
      />
    </View>
  );
};

interface CurrencyButtonProps {
  label: string;
  currency: Currency;
  isSelected: boolean;
  onTap: () => void;
}

const CurrencyButton: React.FC<CurrencyButtonProps> = ({
  label,
  isSelected,
  onTap,
}) => {
  return (
    <TouchableOpacity
      onPress={onTap}
      style={[styles.button, isSelected && styles.buttonSelected]}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, isSelected && styles.buttonTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#616161',
    overflow: 'hidden',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: '#1976D2',
  },
  buttonText: {
    color: '#BDBDBD',
    fontSize: 14,
  },
  buttonTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});



