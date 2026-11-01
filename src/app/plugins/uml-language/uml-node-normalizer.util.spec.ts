import { UmlNodeNormalizerUtil } from './uml-node-normalizer.util';

describe('UmlNodeNormalizerUtil Method Normalization', () => {
  it('separa el nombre de la función y los parámetros cuando vienen agrupados', () => {
    const result = UmlNodeNormalizerUtil.normalizeMethod({
      name: 'actualizarStock(cantidad)',
    });
    expect(result.name).toBe('actualizarStock');
    expect(result.parameters).toBe('cantidad');
    expect(result.returnType).toBe('void');
  });

  it('separa firma con parámetros y tipo de retorno', () => {
    const result = UmlNodeNormalizerUtil.normalizeMethod({
      name: 'calcularDescuento(pct: double): BigDecimal',
    });
    expect(result.name).toBe('calcularDescuento');
    expect(result.parameters).toBe('pct: double');
    expect(result.returnType).toBe('BigDecimal');
  });

  it('conserva parámetros explícitos y limpia paréntesis redundantes', () => {
    const result = UmlNodeNormalizerUtil.normalizeMethod({
      name: 'procesarPago',
      parameters: '(monto: Double, moneda: String)',
      returnType: 'Boolean',
    });
    expect(result.name).toBe('procesarPago');
    expect(result.parameters).toBe('monto: Double, moneda: String');
    expect(result.returnType).toBe('Boolean');
  });
});
