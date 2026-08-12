import React from 'react';
import { View, Text } from 'react-native';
import { Currency } from '../../models/Currency';
import { CompoundStepRow, signedPctDisplay } from '../../lib/baseCompoundCalc';
import { formatCurrency } from '../../utils/formatUtils';
import { baseCompoundStyles as s } from './baseCompoundStyles';

type NodeVariant = 'start' | 'step' | 'recovery' | 'final';

type Props = {
  start: number;
  steps: CompoundStepRow[];
  currency: Currency;
  recoveryStep?: CompoundStepRow;
};

function pctColor(pct: number): string {
  if (pct > 0) return '#66BB6A';
  if (pct < 0) return '#EF5350';
  return '#B0BEC5';
}

function TimelineConnector({ pct, recovery }: { pct: number; recovery?: boolean }) {
  return (
    <View style={s.pathTimelineConnectorRow}>
      <View style={s.pathTimelineRailCol}>
        <View style={s.pathTimelineLine} />
      </View>
      <View style={[s.pathTimelinePctChip, recovery && s.pathTimelinePctChipRecovery]}>
        <Text style={[s.pathTimelinePctChipText, { color: recovery ? '#FFB74D' : pctColor(pct) }]}>
          {recovery ? `↩ ${signedPctDisplay(pct)}` : signedPctDisplay(pct)}
        </Text>
      </View>
    </View>
  );
}

function TimelineNode({
  label,
  price,
  cumulativePct,
  variant,
  isLast,
  currency,
}: {
  label: string;
  price: number;
  cumulativePct: number;
  variant: NodeVariant;
  isLast?: boolean;
  currency: Currency;
}) {
  const dotStyle =
    variant === 'start'
      ? s.pathTimelineDotStart
      : variant === 'final'
        ? s.pathTimelineDotFinal
        : variant === 'recovery'
          ? s.pathTimelineDotRecovery
          : s.pathTimelineDotStep;

  const cardVariantStyle =
    variant === 'start'
      ? s.pathTimelineCardStart
      : variant === 'final'
        ? s.pathTimelineCardFinal
        : null;

  return (
    <View style={s.pathTimelineNodeRow}>
      <View style={s.pathTimelineRailCol}>
        <View style={[s.pathTimelineDot, dotStyle]} />
        {!isLast ? <View style={s.pathTimelineLineFlex} /> : null}
      </View>
      <View style={[s.pathTimelineCard, cardVariantStyle]}>
        <View style={s.pathTimelineCardHeader}>
          <Text style={s.pathTimelineLabel}>{label}</Text>
          <Text style={[s.pathTimelineCumulative, { color: pctColor(cumulativePct) }]}>
            누적 {signedPctDisplay(cumulativePct)}
          </Text>
        </View>
        <Text style={s.pathTimelinePrice}>{formatCurrency(price, currency)}</Text>
      </View>
    </View>
  );
}

export function PathTimeline({ start, steps, currency, recoveryStep }: Props) {
  return (
    <View style={s.pathTimeline}>
      <TimelineNode
        label="시작"
        price={start}
        cumulativePct={0}
        variant="start"
        isLast={steps.length === 0 && !recoveryStep}
        currency={currency}
      />
      {steps.map((step, i) => {
        const isLastNode = !recoveryStep && i === steps.length - 1;
        return (
          <React.Fragment key={step.index}>
            <TimelineConnector pct={step.stepPct} />
            <TimelineNode
              label={`${step.index}단계`}
              price={step.priceAfter}
              cumulativePct={step.cumulativePct}
              variant="step"
              isLast={isLastNode}
              currency={currency}
            />
          </React.Fragment>
        );
      })}
      {recoveryStep ? (
        <>
          <TimelineConnector pct={recoveryStep.stepPct} recovery />
          <TimelineNode
            label="최종"
            price={recoveryStep.priceAfter}
            cumulativePct={recoveryStep.cumulativePct}
            variant="final"
            isLast
            currency={currency}
          />
        </>
      ) : null}
    </View>
  );
}
