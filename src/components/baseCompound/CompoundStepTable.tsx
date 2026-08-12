import React from 'react';
import { View, Text } from 'react-native';
import { Currency } from '../../models/Currency';
import { formatCurrency } from '../../utils/formatUtils';
import { CompoundStepRow } from '../../lib/baseCompoundCalc';
import { formatPctDisplay } from '../../lib/baseCompoundCalc';
import { baseCompoundStyles as s } from './baseCompoundStyles';

type Props = {
  steps: CompoundStepRow[];
  currency: Currency;
  /** 변동 후 → 최종 회복 구간 (경로 시나리오) */
  recoveryStep?: CompoundStepRow;
};

function StepRow({
  row,
  indexLabel,
  currency,
}: {
  row: CompoundStepRow;
  indexLabel: string | number;
  currency: Currency;
}) {
  return (
    <View style={s.stepRow}>
      <Text style={s.stepCell}>{indexLabel}</Text>
      <Text style={[s.stepCell, { color: row.stepPct >= 0 ? '#66BB6A' : '#EF5350' }]}>
        {formatPctDisplay(row.stepPct)}%
      </Text>
      <Text style={s.stepCell} numberOfLines={1}>
        {formatCurrency(row.priceAfter, currency)}
      </Text>
      <Text style={[s.stepCell, { color: row.cumulativePct >= 0 ? '#66BB6A' : '#EF5350' }]}>
        {formatPctDisplay(row.cumulativePct)}%
      </Text>
    </View>
  );
}

export function CompoundStepTable({ steps, currency, recoveryStep }: Props) {
  if (steps.length === 0 && !recoveryStep) return null;

  return (
    <View style={s.stepTable}>
      <View style={s.stepHeader}>
        <Text style={s.stepCellHead}>회차</Text>
        <Text style={s.stepCellHead}>변동 %</Text>
        <Text style={s.stepCellHead}>가격</Text>
        <Text style={s.stepCellHead}>누적 %</Text>
      </View>
      {steps.map((row) => (
        <StepRow key={row.index} row={row} indexLabel={row.index} currency={currency} />
      ))}
      {recoveryStep ? (
        <StepRow key="recovery" row={recoveryStep} indexLabel="↩" currency={currency} />
      ) : null}
    </View>
  );
}
