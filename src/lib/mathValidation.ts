import { DropoutCurveTable, BlockDropoutAnalysis } from '@/types';

/**
 * Валидирует корректность данных кривой досмотра
 */
export function validateDropoutCurve(dropoutCurve: DropoutCurveTable): string[] {
  const errors: string[] = [];

  if (!dropoutCurve.points || dropoutCurve.points.length === 0) {
    errors.push('Отсутствуют точки данных в кривой досмотра');
    return errors;
  }

  // Проверяем, что первая точка начинается с 0 или близко к 0
  const firstPoint = dropoutCurve.points[0];
  if (firstPoint.timestamp > 1) {
    errors.push('Первая точка должна начинаться близко к 0 секундам');
  }

  // Проверяем, что процент удержания в начале близок к 100%
  if (firstPoint.retentionPercentage < 95) {
    errors.push(`Начальное удержание слишком низкое: ${firstPoint.retentionPercentage}%`);
  }

  // Проверяем математическую корректность каждой точки
  for (let i = 0; i < dropoutCurve.points.length; i++) {
    const point = dropoutCurve.points[i];
    
    // Проверяем, что процент отвала = 100% - процент удержания
    const expectedDropout = 100 - point.retentionPercentage;
    const dropoutDiff = Math.abs(point.dropoutPercentage - expectedDropout);
    
    if (dropoutDiff > 0.1) { // Допуск 0.1%
      errors.push(`Точка ${i}: некорректный расчет отвала (${point.dropoutPercentage}% vs ожидаемый ${expectedDropout}%)`);
    }

    // Проверяем, что значения в разумных пределах
    if (point.retentionPercentage < 0 || point.retentionPercentage > 100) {
      errors.push(`Точка ${i}: удержание вне диапазона 0-100%: ${point.retentionPercentage}%`);
    }

    if (point.dropoutPercentage < 0 || point.dropoutPercentage > 100) {
      errors.push(`Точка ${i}: отвал вне диапазона 0-100%: ${point.dropoutPercentage}%`);
    }

    // Проверяем монотонность (удержание не должно расти)
    if (i > 0) {
      const prevPoint = dropoutCurve.points[i - 1];
      if (point.retentionPercentage > prevPoint.retentionPercentage + 5) { // Допуск 5% для небольших колебаний
        errors.push(`Точка ${i}: удержание неожиданно выросло с ${prevPoint.retentionPercentage}% до ${point.retentionPercentage}%`);
      }
    }
  }

  return errors;
}

/**
 * Валидирует корректность расчета отвалов блоков
 */
export function validateBlockDropouts(blockDropouts: BlockDropoutAnalysis[]): string[] {
  const errors: string[] = [];

  for (const block of blockDropouts) {
    // Проверяем математическую корректность
    const expectedAbsoluteDropout = block.startRetention - block.endRetention;
    const absoluteDiff = Math.abs(block.absoluteDropout - expectedAbsoluteDropout);
    
    if (absoluteDiff > 0.1) {
      errors.push(`Блок ${block.blockName}: некорректный абсолютный отвал (${block.absoluteDropout} vs ожидаемый ${expectedAbsoluteDropout})`);
    }

    // Проверяем относительный отвал - это процент зрителей, которые отвалились, 
    // от общего числа зрителей, которые смотрели в начале блока
    if (block.startRetention > 0) {
      const expectedRelativeDropout = (block.absoluteDropout / block.startRetention) * 100;
      const relativeDiff = Math.abs(block.relativeDropout - expectedRelativeDropout);
      
      if (relativeDiff > 0.1) {
        errors.push(`Блок ${block.blockName}: некорректный относительный отвал (${block.relativeDropout.toFixed(1)}% vs ожидаемый ${expectedRelativeDropout.toFixed(1)}%)`);
      }
    }

    // Проверяем, что время блока корректно
    if (block.startTime >= block.endTime) {
      errors.push(`Блок ${block.blockName}: некорректное время (начало ${block.startTime}s >= конец ${block.endTime}s)`);
    }

    // Проверяем, что значения удержания в разумных пределах
    if (block.startRetention < 0 || block.startRetention > 100) {
      errors.push(`Блок ${block.blockName}: начальное удержание вне диапазона: ${block.startRetention}%`);
    }

    if (block.endRetention < 0 || block.endRetention > 100) {
      errors.push(`Блок ${block.blockName}: конечное удержание вне диапазона: ${block.endRetention}%`);
    }

    // Проверяем, что относительный отвал не отрицательный
    if (block.relativeDropout < 0) {
      errors.push(`Блок ${block.blockName}: отрицательный относительный отвал: ${block.relativeDropout}%`);
    }
  }

  return errors;
}

/**
 * Исправляет распространенные математические ошибки в данных
 */
export function fixCommonMathErrors(dropoutCurve: DropoutCurveTable): DropoutCurveTable {
  const fixedPoints = dropoutCurve.points.map(point => {
    // Исправляем расчет процента отвала
    const correctedDropout = 100 - point.retentionPercentage;
    
    return {
      ...point,
      retentionPercentage: Math.round(Math.max(0, Math.min(100, point.retentionPercentage)) * 100) / 100,
      dropoutPercentage: Math.round(Math.max(0, Math.min(100, correctedDropout)) * 100) / 100,
      timestamp: Math.round(point.timestamp * 100) / 100
    };
  });

  return {
    ...dropoutCurve,
    points: fixedPoints
  };
}

/**
 * Функция для проверки и исправления математических ошибок в анализе
 */
export function validateAndFixAnalysis(
  dropoutCurve: DropoutCurveTable, 
  blockDropouts: BlockDropoutAnalysis[]
): { 
  isValid: boolean; 
  errors: string[]; 
  fixedDropoutCurve: DropoutCurveTable; 
} {
  let errors: string[] = [];
  
  // Валидируем кривую досмотра
  const curveErrors = validateDropoutCurve(dropoutCurve);
  errors = errors.concat(curveErrors);
  
  // Валидируем отвалы блоков
  const blockErrors = validateBlockDropouts(blockDropouts);
  errors = errors.concat(blockErrors);
  
  // Исправляем распространенные ошибки
  const fixedDropoutCurve = fixCommonMathErrors(dropoutCurve);
  
  return {
    isValid: errors.length === 0,
    errors,
    fixedDropoutCurve
  };
} 