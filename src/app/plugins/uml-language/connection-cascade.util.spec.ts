import { ConnectionCascadeUtil } from './connection-cascade.util';

describe('ConnectionCascadeUtil Base ID Resolution', () => {
  it('extrae el ID base de nodos con puertos compuestos (_top_start, _bottom_end, _slot_4)', () => {
    expect(ConnectionCascadeUtil.extractBaseNodeId('node_123_top_start')).toBe('node_123');
    expect(ConnectionCascadeUtil.extractBaseNodeId('node_abc_bottom_end')).toBe('node_abc');
    expect(ConnectionCascadeUtil.extractBaseNodeId('user_node_left')).toBe('user_node');
    expect(ConnectionCascadeUtil.extractBaseNodeId('order_slot_3')).toBe('order');
    expect(ConnectionCascadeUtil.extractBaseNodeId('plain_node_id')).toBe('plain_node_id');
    expect(ConnectionCascadeUtil.extractBaseNodeId(undefined)).toBe('');
  });
});

