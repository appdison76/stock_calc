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
        {(() => {
          // 괄호 안에 화살표가 있는 경우 처리 (총 매도 금액 등)
          const parenMatch = value.match(/^(.+?) \((\u2191|\u2193) (.+?)\)/);
          if (parenMatch) {
            const beforeParen = parenMatch[1];
            const arrow = parenMatch[2];
            const arrowContent = parenMatch[3];
            let rest = value.substring(parenMatch[0].length);
            const arrowColor = arrow === '↑' ? '#EF5350' : '#42A5F5';
            
            // 원화 부분 처리 (줄바꿈 후 괄호 안의 화살표와 금액)
            let krwPart = null;
            if (rest.includes('\n(')) {
              const krwMatch = rest.match(/\n\((.+?) (\u2191|\u2193) (.+?)\)/);
              if (krwMatch) {
                const krwBeforeArrow = krwMatch[1];
                const krwArrow = krwMatch[2];
                const krwAmount = krwMatch[3];
                const krwAfter = rest.substring(krwMatch[0].length);
                
                krwPart = (
                  <>
                    {'\n'}
                    <Text style={{ color: valueColor }}>(</Text>
                    <Text style={{ color: valueColor }}>{krwBeforeArrow} </Text>
                    <Text style={{ color: arrowColor }}>{krwArrow} </Text>
                    <Text style={{ color: arrowColor }}>{krwAmount}</Text>
                    <Text style={{ color: valueColor }}>)</Text>
                    {krwAfter && <Text style={{ color: valueColor }}>{krwAfter}</Text>}
                  </>
                );
                rest = '';
              }
            }
            
            return (
              <Text style={[styles.value]} numberOfLines={2}>
                <Text style={{ color: valueColor }}>{beforeParen}</Text>
                <Text style={{ color: arrowColor }}> (</Text>
                <Text style={{ color: arrowColor }}>{arrow} </Text>
                <Text style={{ color: arrowColor }}>{arrowContent}</Text>
                <Text style={{ color: arrowColor }}>)</Text>
                {krwPart || (rest && <Text style={{ color: valueColor }}>{rest}</Text>)}
              </Text>
            );
          }
          
          // 화살표로 시작하는 경우 (물타기 평균 단가 등)
          if (value.startsWith('↑ ') || value.startsWith('↓ ')) {
            return (
              <Text style={[styles.value]} numberOfLines={2}>
                <Text style={{ color: value.startsWith('↑ ') ? '#EF5350' : '#42A5F5' }}>
                  {value.substring(0, 2)}
                </Text>
                <Text style={{ color: valueColor }}>
                  {value.substring(2)}
                </Text>
              </Text>
            );
          }
          
          // 기본 케이스
          return (
            <Text style={[styles.value, { color: valueColor }]} numberOfLines={2}>
              {value}
            </Text>
          );
        })()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.15)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
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
    color: '#B0BEC5',
  },
  spacer: {
    width: 6,
  },
  spacerSmall: {
    height: 6,
  },
  title: {
    flex: 1,
    color: '#CFD8DC',
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 19,
    fontWeight: 'bold',
    lineHeight: 22.8,
  },
});

