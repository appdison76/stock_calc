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
          // 원화 표시 처리 (줄바꿈 후 "원화"로 시작하는 경우) - 먼저 체크
          if (value.includes('\n원화 ')) {
            const parts = value.split('\n원화 ');
            const mainPart = parts[0];
            const krwPart = parts[1];
            
            // 원화 부분에 부호가 있는 경우 (총 매도 금액 등) - 괄호 안에 +/-
            const krwArrowMatch = krwPart.match(/^(.+?) \(([+\-]) (.+?)\)$/);
            if (krwArrowMatch) {
              const krwBeforeArrow = krwArrowMatch[1];
              const krwArrow = krwArrowMatch[2];
              const krwAmount = krwArrowMatch[3];
              const arrowColor = krwArrow === '+' ? '#4CAF50' : '#F44336'; // 미국 스타일: 상승=녹색, 하락=빨간색
              
              // mainPart에 괄호 안에 부호가 있는 경우 처리
              const parenMatch = mainPart.match(/^(.+?) \(([+\-]) (.+?)\)$/);
              if (parenMatch) {
                const beforeParen = parenMatch[1];
                const arrow = parenMatch[2];
                const arrowContent = parenMatch[3];
                const mainArrowColor = arrow === '+' ? '#4CAF50' : '#F44336';
                
                return (
                  <Text style={[styles.value]} numberOfLines={2}>
                    <Text style={{ color: valueColor }}>{beforeParen}</Text>
                    <Text style={{ color: mainArrowColor }}> (</Text>
                    <Text style={{ color: mainArrowColor }}>{arrow} </Text>
                    <Text style={{ color: mainArrowColor }}>{arrowContent}</Text>
                    <Text style={{ color: mainArrowColor }}>)</Text>
                    {'\n'}
                    <Text style={[styles.krwLabel, { color: valueColor }]}>원화 {krwBeforeArrow} </Text>
                    <Text style={[styles.krwLabel, { color: arrowColor }]}>(</Text>
                    <Text style={[styles.krwLabel, { color: arrowColor }]}>{krwArrow} </Text>
                    <Text style={[styles.krwLabel, { color: arrowColor }]}>{krwAmount}</Text>
                    <Text style={[styles.krwLabel, { color: arrowColor }]}>)</Text>
                  </Text>
                );
              }
              
              return (
                <Text style={[styles.value]} numberOfLines={2}>
                  <Text style={{ color: valueColor }}>{mainPart}</Text>
                  {'\n'}
                  <Text style={[styles.krwLabel, { color: valueColor }]}>원화 {krwBeforeArrow} </Text>
                  <Text style={[styles.krwLabel, { color: arrowColor }]}>(</Text>
                  <Text style={[styles.krwLabel, { color: arrowColor }]}>{krwArrow} </Text>
                  <Text style={[styles.krwLabel, { color: arrowColor }]}>{krwAmount}</Text>
                  <Text style={[styles.krwLabel, { color: arrowColor }]}>)</Text>
                </Text>
              );
            }
            
            return (
              <Text style={[styles.value]} numberOfLines={2}>
                <Text style={{ color: valueColor }}>{mainPart}</Text>
                {'\n'}
                <Text style={[styles.krwLabel, { color: valueColor }]}>원화 {krwPart}</Text>
              </Text>
            );
          }
          
          // 괄호 안에 부호가 있는 경우 처리 (총 매도 금액 등)
          const parenMatch = value.match(/^(.+?) \(([+\-]) (.+?)\)/);
          if (parenMatch) {
            const beforeParen = parenMatch[1];
            const arrow = parenMatch[2];
            const arrowContent = parenMatch[3];
            let rest = value.substring(parenMatch[0].length);
            const arrowColor = arrow === '+' ? '#4CAF50' : '#F44336'; // 미국 스타일: 상승=녹색, 하락=빨간색
            
            return (
              <Text style={[styles.value]} numberOfLines={2}>
                <Text style={{ color: valueColor }}>{beforeParen}</Text>
                <Text style={{ color: arrowColor }}> (</Text>
                <Text style={{ color: arrowColor }}>{arrow} </Text>
                <Text style={{ color: arrowColor }}>{arrowContent}</Text>
                <Text style={{ color: arrowColor }}>)</Text>
                {rest && <Text style={{ color: valueColor }}>{rest}</Text>}
              </Text>
            );
          }
          
          // +/-로 시작하는 경우 (물타기 평균 단가 등)
          if (value.startsWith('+ ') || value.startsWith('- ')) {
            return (
              <Text style={[styles.value]} numberOfLines={2}>
                <Text style={{ color: value.startsWith('+ ') ? '#EF5350' : '#42A5F5' }}>
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
  krwLabel: {
    fontSize: 14,
    fontWeight: 'normal',
  },
});

