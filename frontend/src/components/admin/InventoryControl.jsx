import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '../../context/SessionContext';

const InventoryControl = ({ onAlertCountChange }) => {
    const { showToast } = useSession();
    
    // Inventory List states
    const [inventory, setInventory] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters state
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    // Modal state for recording transactions
    const [txModalOpen, setTxModalOpen] = useState(false);
    const [selectedItemIdx, setSelectedItemIdx] = useState("");
    const [txType, setTxType] = useState("receive");
    const [txQty, setTxQty] = useState("");
    const [txPerformedBy, setTxPerformedBy] = useState("Stylist Priya");
    const [submittingTx, setSubmittingTx] = useState(false);

    const loadInventoryData = async () => {
        setLoading(true);
        try {
            // Fetch Inventory items
            const invRes = await fetch(`${window.location.origin}/api/inventory`);
            if (!invRes.ok) throw new Error("Failed to load inventory");
            const invData = await invRes.json();
            setInventory(invData.products || []);

            // Fetch active Alerts
            const alertsRes = await fetch(`${window.location.origin}/api/inventory/alerts`);
            if (!alertsRes.ok) throw new Error("Failed to load alerts");
            const alertsData = await alertsRes.json();
            setAlerts(alertsData.alerts || []);
            
            // Notify parent Header about alerts count changes
            if (onAlertCountChange) {
                onAlertCountChange(alertsData.alerts.length);
            }

            // Fetch Suppliers
            const supRes = await fetch(`${window.location.origin}/api/suppliers`);
            if (!supRes.ok) throw new Error("Failed to load suppliers");
            const supData = await supRes.json();
            setSuppliers(supData.suppliers || []);

        } catch (err) {
            console.error(err);
            showToast("Failed to load warehouse inventory database.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventoryData();
    }, []);

    // Filter items based on criteria
    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = 
                item.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
                (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            
            const matchesCategory = 
                selectedCategory === "all" || item.salon_category === selectedCategory;
            
            const matchesLowStock = 
                !showLowStockOnly || (item.quantity_in_stock <= item.safety_stock_level);

            return matchesSearch && matchesCategory && matchesLowStock;
        });
    }, [inventory, searchTerm, selectedCategory, showLowStockOnly]);

    // Group alerts by supplier
    const groupedAlerts = useMemo(() => {
        const groups = {};
        alerts.forEach(alert => {
            const supplierName = alert.supplier_name || 'Unassigned Supplier';
            if (!groups[supplierName]) {
                groups[supplierName] = [];
            }
            groups[supplierName].push(alert);
        });
        return groups;
    }, [alerts]);

    // Record Stock Movement Transaction
    const handleExecuteTransaction = async (e) => {
        e.preventDefault();
        if (selectedItemIdx === "" || !txQty || !txPerformedBy.trim()) {
            showToast("Please fill in all transaction fields.");
            return;
        }

        const quantity = parseFloat(txQty);
        if (isNaN(quantity)) {
            showToast("Invalid quantity quantity.");
            return;
        }

        const selectedItem = inventory[selectedItemIdx];
        setSubmittingTx(true);

        try {
            const res = await fetch(`${window.location.origin}/api/inventory/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: selectedItem.id,
                    inventory_type: selectedItem.inventory_type,
                    transaction_type: txType,
                    quantity: quantity,
                    performed_by: txPerformedBy.trim()
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Transaction failed");
            }

            showToast("Stock movement recorded successfully!");
            setTxModalOpen(false);
            setTxQty("");
            setSelectedItemIdx("");
            
            // Reload updated inventory levels
            await loadInventoryData();
        } catch (err) {
            console.error(err);
            showToast("Failed to record stock movement: " + err.message);
        } finally {
            setSubmittingTx(false);
        }
    };

    // Send PO Mock action
    const handleSendPO = (supplierName) => {
        showToast(`Purchase order email sent to ${supplierName} successfully!`);
    };

    return (
        <div className="inv-layout-grid" style={{ animation: 'fadeIn 0.6s ease-out' }}>
            
            {/* Sidebar Controls */}
            <div className="inv-filter-sidebar textured-element" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: 'var(--text-bright)', margin: '0 0 4px 0', fontSize: '1.1rem' }}>
                        Warehouse Filters
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', margin: 0 }}>
                        Segment stock products & raw materials.
                    </p>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>Search Inventory</label>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-main)', fontSize: '0.85rem' }}></i>
                        <input 
                            type="text" 
                            placeholder="SKU, Brand, Name..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '10px 12px 10px 34px', 
                                background: 'rgba(255, 255, 255, 0.3)', 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: '10px', 
                                fontSize: '0.85rem', 
                                color: 'var(--text-bright)', 
                                outline: 'none' 
                            }}
                        />
                    </div>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>Salon Category</label>
                    <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        style={{ 
                            width: '100%', 
                            padding: '10px 12px', 
                            background: 'rgba(255, 255, 255, 0.3)', 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: '10px', 
                            color: 'var(--text-bright)', 
                            fontSize: '0.85rem', 
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">All Category Items</option>
                        <option value="hair_care">Hair Care Products</option>
                        <option value="styling">Stylist Products</option>
                        <option value="color">Color Retouch Dyes</option>
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                        type="checkbox" 
                        id="invLowStockCheckbox" 
                        checked={showLowStockOnly}
                        onChange={(e) => setShowLowStockOnly(e.target.checked)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                    />
                    <label htmlFor="invLowStockCheckbox" style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500, cursor: 'pointer' }}>
                        Show Low Stock Only
                    </label>
                </div>

                <button 
                    className="btn" 
                    onClick={() => setTxModalOpen(true)}
                    style={{ marginTop: '10px', width: '100%', borderRadius: '12px', boxShadow: 'none', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <i className="fa-solid fa-right-left"></i> 
                    Record Stock Movement
                </button>
            </div>

            {/* Main Warehouse Workspace */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Stats row cards */}
                <div className="inv-stats-row">
                    <div className="inv-stat-card textured-element" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px' }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Stock Items</span>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '4px' }}>{inventory.length}</div>
                        </div>
                        <i className="fa-solid fa-tags" style={{ fontSize: '1.8rem', color: 'var(--accent-primary)', opacity: 0.7 }}></i>
                    </div>

                    <div className="inv-stat-card textured-element" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px' }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Low Stock Alerts</span>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ff8080', marginTop: '4px' }}>{alerts.length}</div>
                        </div>
                        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.8rem', color: '#ff8080', opacity: 0.7 }}></i>
                    </div>

                    <div className="inv-stat-card textured-element" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px' }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier Partners</span>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '4px' }}>{suppliers.length}</div>
                        </div>
                        <i className="fa-solid fa-truck" style={{ fontSize: '1.8rem', color: 'var(--accent-primary)', opacity: 0.7 }}></i>
                    </div>
                </div>

                {/* Table Workspace & Reorder alert side panel */}
                <div className="inv-workspace-grid">
                    {/* Database Table view */}
                    <div className="inv-table-card textured-element" style={{ height: 'fit-content', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: '520px' }}>
                            <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-bright)' }}>
                                        <th style={{ padding: '16px 20px', fontSize: '0.85rem' }}>Item Name</th>
                                        <th style={{ padding: '16px 20px', fontSize: '0.85rem' }}>SKU / Brand</th>
                                        <th style={{ padding: '16px 20px', fontSize: '0.85rem' }}>Stock</th>
                                        <th style={{ padding: '16px 20px', fontSize: '0.85rem' }}>Safety</th>
                                        <th style={{ padding: '16px 20px', fontSize: '0.85rem' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && inventory.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-main)', padding: '24px' }}>
                                                <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px' }}></i> Loading stock logs...
                                            </td>
                                        </tr>
                                    ) : filteredInventory.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-main)', padding: '24px' }}>
                                                No inventory items found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInventory.map(item => {
                                            const isLow = item.quantity_in_stock <= item.safety_stock_level;
                                            const unit = item.inventory_type === 'product' ? 'pcs' : (item.unit || 'g/ml');
                                            return (
                                                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <td style={{ padding: '16px 20px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '0.9rem' }}>{item.name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', textTransform: 'capitalize', fontWeight: 500 }}>
                                                                {item.salon_category.replace('_', ' ')} • {item.inventory_type === 'product' ? (
                                                                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', border: '1px solid rgba(222, 184, 118, 0.2)', background: 'rgba(222, 184, 118, 0.05)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>RETAIL</span>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.65rem', color: '#f090b0', border: '1px solid rgba(240, 144, 176, 0.2)', background: 'rgba(240, 144, 176, 0.05)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>BACKBAR</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px' }}>
                                                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-bright)', fontWeight: 600 }}>{item.sku || 'N/A'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>{item.brand || 'No Brand'}</div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', fontWeight: 700, color: isLow ? '#ff8080' : 'var(--text-bright)' }}>
                                                        {item.quantity_in_stock} {unit}
                                                    </td>
                                                    <td style={{ padding: '16px 20px', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                                        {item.safety_stock_level} {unit}
                                                    </td>
                                                    <td style={{ padding: '16px 20px' }}>
                                                        {isLow ? (
                                                            <span className="inv-badge-stock critical" style={{ fontSize: '0.65rem', background: 'rgba(255, 74, 74, 0.1)', color: '#ff8080', border: '1px solid rgba(255, 74, 74, 0.2)', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>CRITICAL</span>
                                                        ) : (
                                                            <span className="inv-badge-stock instock" style={{ fontSize: '0.65rem', background: 'rgba(86, 219, 149, 0.1)', color: '#56db95', border: '1px solid rgba(86, 219, 149, 0.2)', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>IN STOCK</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Restock Alerts panel */}
                    <div className="inv-table-card textured-element" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '520px', overflowY: 'auto' }}>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: 'var(--text-bright)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', fontSize: '1rem', margin: 0 }}>
                            <i className="fa-solid fa-bell" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', marginRight: '6px' }}></i> Restock Alerts & POs
                        </h3>
                        
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {alerts.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-main)', padding: '40px 20px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignSelf: 'center', alignItems: 'center', gap: '12px' }}>
                                    <i className="fa-solid fa-circle-check" style={{ fontSize: '2.2rem', color: '#56db95' }}></i>
                                    <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>All Stock Levels Healthy</span>
                                    <span>No purchase orders required at this time.</span>
                                </div>
                            ) : (
                                Object.entries(groupedAlerts).map(([supplierName, items]) => (
                                    <div 
                                        key={supplierName}
                                        className="inv-alert-card warning-glow"
                                        style={{ 
                                            background: 'rgba(229, 160, 76, 0.03)', 
                                            border: '1px solid var(--glass-border)', 
                                            borderRadius: '12px', 
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '10px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <i className="fa-solid fa-truck" style={{ color: 'var(--accent-primary)' }}></i>
                                                {supplierName}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', background: 'rgba(255, 74, 74, 0.1)', color: '#ff8080', border: '1px solid rgba(255, 74, 74, 0.2)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                                DRAFT PO
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {items.map(item => {
                                                const unit = item.inventory_type === 'product' ? 'pcs' : 'units';
                                                return (
                                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px dotted var(--glass-border)', paddingBottom: '6px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{item.name}</span>
                                                            <span style={{ fontSize: '0.7rem', color: '#ff8080', fontWeight: 600 }}>
                                                                Current: {item.quantity_in_stock} (Min: {item.safety_stock_level})
                                                            </span>
                                                        </div>
                                                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                                            +{item.reorder_quantity} {unit}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-main)', fontWeight: 600 }}>
                                                {items.length} low SKU{items.length > 1 ? 's' : ''}
                                            </span>
                                            <button 
                                                className="btn btn-secondary" 
                                                onClick={() => handleSendPO(supplierName)}
                                                style={{ 
                                                    fontSize: '0.7rem', 
                                                    padding: '6px 12px', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid var(--accent-primary)', 
                                                    color: 'var(--accent-primary)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '6px', 
                                                    background: 'transparent', 
                                                    fontWeight: 700 
                                                }}
                                            >
                                                <i className="fa-solid fa-paper-plane" style={{ fontSize: '0.75rem' }}></i> Send PO
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Record Stock Movement Modal */}
            {txModalOpen && (
                <div 
                    className="generic-modal-overlay show"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 2500,
                        background: 'rgba(250, 249, 246, 0.75)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <form 
                        onSubmit={handleExecuteTransaction}
                        className="generic-modal-card textured-element"
                        style={{
                            maxWidth: '450px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '90%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.2rem', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-right-left" style={{ color: 'var(--accent-primary)' }}></i>
                                Record Stock Movement
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setTxModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer', outline: 'none' }}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Select Inventory Item</label>
                            <select 
                                value={selectedItemIdx}
                                onChange={(e) => setSelectedItemIdx(e.target.value)}
                                required
                                style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="">-- Choose Product/Material --</option>
                                {inventory.map((item, idx) => (
                                    <option key={item.id} value={idx}>
                                        {item.name} ({item.sku || 'No SKU'}) - Stock: {item.quantity_in_stock}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Movement Type</label>
                                <select 
                                    value={txType}
                                    onChange={(e) => setTxType(e.target.value)}
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="receive">Receive Stock (+)</option>
                                    <option value="sale">Client Sale (-)</option>
                                    <option value="usage">Stylist Usage (-)</option>
                                    <option value="adjustment">Manual Adjustment</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Quantity Delta</label>
                                <input 
                                    type="number" 
                                    placeholder="e.g. 5 or -2" 
                                    step="any"
                                    value={txQty}
                                    onChange={(e) => setTxQty(e.target.value)}
                                    required
                                    style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>Performed By</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Stylist Priya" 
                                value={txPerformedBy}
                                onChange={(e) => setTxPerformedBy(e.target.value)}
                                required
                                style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-bright)', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px', marginTop: '10px' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => setTxModalOpen(false)}
                                style={{ borderRadius: '8px', padding: '8px 16px' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn"
                                disabled={submittingTx}
                                style={{ borderRadius: '8px', padding: '8px 16px' }}
                            >
                                {submittingTx ? "Executing..." : "Execute"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default InventoryControl;
