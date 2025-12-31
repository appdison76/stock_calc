import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { searchStocks, StockSearchResult } from '../services/YahooFinanceService';

interface StockSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (ticker: string, officialName: string) => void;
  placeholder?: string;
  title?: string;
}

// 디바운싱을 위한 커스텀 훅
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function StockSearchModal({
  visible,
  onClose,
  onSelect,
  placeholder = '예: 삼성전자, 005930, Apple Inc',
  title = '종목 검색',
}: StockSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const debouncedSearchQuery = useDebounce(searchQuery, 500); // 500ms 디바운싱

  // 검색 실행
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        setShowManualInput(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchStocks(debouncedSearchQuery);
        setSearchResults(results);
        // 검색 결과가 없거나, 사용자가 직접 입력하고 싶을 때를 위한 옵션
        setShowManualInput(true);
      } catch (error) {
        console.error('종목 검색 오류:', error);
        setSearchResults([]);
        setShowManualInput(true);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery]);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setShowManualInput(false);
      setManualInput('');
    }
  }, [visible]);

  const handleSelectResult = (result: StockSearchResult) => {
    onSelect(result.symbol, result.name);
    onClose();
  };

  const handleManualInput = () => {
    if (manualInput.trim()) {
      // 수동 입력 시 티커는 입력값 그대로 사용, officialName은 빈 문자열(매칭 안됨)
      onSelect(manualInput.trim(), '');
      onClose();
    }
  };

  const renderSearchResult = ({ item }: { item: StockSearchResult }) => {
    const isKoreanStock = item.symbol?.endsWith('.KS');
    
    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleSelectResult(item)}
        activeOpacity={0.7}
      >
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          {/* 한국 주식이고 원래 영문명이 있는 경우 표시 */}
          {isKoreanStock && item.originalName && (
            <Text style={styles.searchResultOriginalName}>{item.originalName}</Text>
          )}
          <View style={styles.searchResultMeta}>
            <Text style={styles.searchResultSymbol}>{item.symbol}</Text>
            {item.exchange && (
              <Text style={styles.searchResultExchange}> · {item.exchange}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          <Text style={styles.modalLabel}>종목 검색</Text>
          <Text style={styles.modalHelperText}>💡 한국 종목은 티커(예: 005930)로 검색하면 더 정확합니다</Text>
          <TextInput
            style={styles.modalInput}
            placeholder={placeholder}
            placeholderTextColor="#757575"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="characters"
          />

          {isSearching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#42A5F5" />
              <Text style={styles.loadingText}>검색 중...</Text>
            </View>
          )}

          {!isSearching && searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>검색 결과</Text>
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.symbol}
                style={styles.resultsList}
                showsVerticalScrollIndicator={false}
                maxToRenderPerBatch={10}
              />
            </View>
          )}

          {!isSearching && debouncedSearchQuery.trim() && searchResults.length === 0 && showManualInput && (
            <View style={styles.manualInputContainer}>
              <Text style={styles.manualInputTitle}>직접 입력</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="종목명을 직접 입력하세요"
                placeholderTextColor="#757575"
                value={manualInput}
                onChangeText={setManualInput}
                onSubmitEditing={handleManualInput}
              />
              <TouchableOpacity
                style={[
                  {
                    width: '100%',
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#42A5F5',
                  },
                  !manualInput.trim() && { opacity: 0.5 }
                ]}
                onPress={handleManualInput}
                disabled={!manualInput.trim()}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }}>확인</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isSearching && !debouncedSearchQuery.trim() && (
            <Text style={styles.helperText}>종목명 또는 티커를 입력하세요</Text>
          )}

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.67)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 8,
  },
  modalHelperText: {
    fontSize: 12,
    color: '#FF9800',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalInput: {
    backgroundColor: 'rgba(27, 38, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.2)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#B0BEC5',
    fontSize: 14,
    marginLeft: 12,
  },
  resultsContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 12,
    fontWeight: '600',
  },
  resultsList: {
    maxHeight: 250,
  },
  searchResultItem: {
    backgroundColor: 'rgba(27, 38, 59, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.1)',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  searchResultOriginalName: {
    fontSize: 13,
    color: '#B0BEC5',
    marginBottom: 4,
  },
  searchResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultSymbol: {
    fontSize: 14,
    color: '#42A5F5',
    fontWeight: '500',
  },
  searchResultExchange: {
    fontSize: 14,
    color: '#757575',
  },
  manualInputContainer: {
    marginBottom: 16,
  },
  manualInputTitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginBottom: 8,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(66, 165, 245, 0.3)',
  },
  modalButtonConfirm: {
    backgroundColor: '#42A5F5',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0BEC5',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

