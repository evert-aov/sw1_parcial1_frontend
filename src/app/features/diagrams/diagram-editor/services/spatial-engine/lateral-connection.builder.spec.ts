import { IFConnectionBuilderRequest } from '@foblex/flow';
import { CalculateLateralLineData } from './lateral-connection.builder';

describe('CalculateLateralLineData', () => {
  const builder = new CalculateLateralLineData();
  const request = (overrides: Partial<IFConnectionBuilderRequest>): IFConnectionBuilderRequest => ({
    source: { x: 0, y: 0 },
    sourceSide: 'bottom' as IFConnectionBuilderRequest['sourceSide'],
    target: { x: 100, y: 100 },
    targetSide: 'left' as IFConnectionBuilderRequest['targetSide'],
    radius: 0,
    offset: 12,
    waypoints: [],
    ...overrides,
  });

  it('lateral vertical: sale vertical y entra lateral con un único codo', () => {
    const result = builder.handle(request({ source: { x: 170, y: 160 }, target: { x: 448, y: 183 } }));
    expect(result.points).toEqual([
      { x: 170, y: 160 },
      { x: 170, y: 183 },
      { x: 448, y: 183 },
    ]);
  });

  it('lateral horizontal: sale lateral y entra vertical con un único codo', () => {
    const result = builder.handle(
      request({
        source: { x: 142, y: 76 },
        sourceSide: 'right' as IFConnectionBuilderRequest['sourceSide'],
        target: { x: 454, y: 192 },
        targetSide: 'top' as IFConnectionBuilderRequest['targetSide'],
      }),
    );
    expect(result.points).toEqual([
      { x: 142, y: 76 },
      { x: 454, y: 76 },
      { x: 454, y: 192 },
    ]);
  });

  it('usa un tramo intermedio cuando ambos lados comparten orientación', () => {
    const result = builder.handle(
      request({ target: { x: 40, y: 100 }, targetSide: 'top' as IFConnectionBuilderRequest['targetSide'] }),
    );
    expect(result.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 40, y: 50 },
      { x: 40, y: 100 },
    ]);
  });
});
