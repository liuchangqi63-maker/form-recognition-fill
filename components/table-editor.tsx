import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { TableData } from '@/shared/types';

interface TableEditorProps {
  tableData: TableData;
  onTableChange: (tableData: TableData) => void;
  editable?: boolean;
}

const MIN_CELL_WIDTH = 100;
const CELL_HEIGHT = 44;
const HEADER_HEIGHT = 48;

export function TableEditor({ tableData, onTableChange, editable = true }: TableEditorProps) {
  const colors = useColors();
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const screenWidth = Dimensions.get('window').width;
  const cellWidth = Math.max(MIN_CELL_WIDTH, (screenWidth - 32) / Math.max(tableData.headers.length, 1));

  const handleCellPress = useCallback((row: number, col: number, value: string) => {
    if (!editable) return;
    setEditingCell({ row, col });
    setEditValue(value);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [editable]);

  const handleCellBlur = useCallback(() => {
    if (!editingCell) return;

    const { row, col } = editingCell;
    
    if (row === -1) {
      // Editing header
      const newHeaders = [...tableData.headers];
      newHeaders[col] = editValue;
      onTableChange({ ...tableData, headers: newHeaders });
    } else {
      // Editing cell
      const newRows = tableData.rows.map((r, i) => 
        i === row ? r.map((c, j) => j === col ? editValue : c) : [...r]
      );
      onTableChange({ ...tableData, rows: newRows });
    }
    
    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, tableData, onTableChange]);

  const addRow = useCallback(() => {
    const newRow = new Array(tableData.headers.length).fill('');
    onTableChange({
      ...tableData,
      rows: [...tableData.rows, newRow],
    });
  }, [tableData, onTableChange]);

  const addColumn = useCallback(() => {
    onTableChange({
      headers: [...tableData.headers, `列${tableData.headers.length + 1}`],
      rows: tableData.rows.map(row => [...row, '']),
    });
  }, [tableData, onTableChange]);

  const deleteRow = useCallback((index: number) => {
    if (tableData.rows.length <= 1) return;
    onTableChange({
      ...tableData,
      rows: tableData.rows.filter((_, i) => i !== index),
    });
  }, [tableData, onTableChange]);

  const deleteColumn = useCallback((index: number) => {
    if (tableData.headers.length <= 1) return;
    onTableChange({
      headers: tableData.headers.filter((_, i) => i !== index),
      rows: tableData.rows.map(row => row.filter((_, i) => i !== index)),
    });
  }, [tableData, onTableChange]);

  const renderCell = (value: string, row: number, col: number, isHeader: boolean) => {
    const isEditing = editingCell?.row === row && editingCell?.col === col;
    
    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        onPress={() => handleCellPress(row, col, value)}
        onLongPress={() => {
          if (editable && row >= 0) {
            deleteRow(row);
          }
        }}
        style={[
          styles.cell,
          {
            width: cellWidth,
            height: isHeader ? HEADER_HEIGHT : CELL_HEIGHT,
            backgroundColor: isHeader ? colors.surface : colors.background,
            borderColor: colors.border,
          },
          isEditing && { borderColor: colors.primary, borderWidth: 2 },
        ]}
        activeOpacity={editable ? 0.7 : 1}
      >
        {isEditing ? (
          <TextInput
            ref={inputRef}
            value={editValue}
            onChangeText={setEditValue}
            onBlur={handleCellBlur}
            onSubmitEditing={handleCellBlur}
            style={[
              styles.cellInput,
              { color: colors.foreground },
              isHeader && styles.headerText,
            ]}
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <Text
            style={[
              styles.cellText,
              { color: colors.foreground },
              isHeader && styles.headerText,
            ]}
            numberOfLines={2}
          >
            {value || (editable ? '点击编辑' : '')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Header Row */}
          <View style={styles.row}>
            {tableData.headers.map((header, col) => renderCell(header, -1, col, true))}
            {editable && (
              <TouchableOpacity
                onPress={addColumn}
                style={[
                  styles.addButton,
                  {
                    height: HEADER_HEIGHT,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.addButtonText, { color: colors.primary }]}>+</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Data Rows */}
          <ScrollView showsVerticalScrollIndicator={true}>
            {tableData.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                {row.map((cell, col) => renderCell(cell, rowIndex, col, false))}
              </View>
            ))}
            
            {/* Add Row Button */}
            {editable && (
              <TouchableOpacity
                onPress={addRow}
                style={[
                  styles.addRowButton,
                  {
                    width: cellWidth * tableData.headers.length,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.addButtonText, { color: colors.primary }]}>+ 添加行</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 0.5,
  },
  cellText: {
    fontSize: 14,
  },
  cellInput: {
    fontSize: 14,
    padding: 0,
    margin: 0,
  },
  headerText: {
    fontWeight: '600',
  },
  addButton: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  addRowButton: {
    height: CELL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderStyle: 'dashed',
  },
});
