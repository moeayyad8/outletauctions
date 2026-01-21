import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { 
  ArrowLeft, Users, Package, TrendingUp, DollarSign, Clock, 
  BarChart3, Plus, Pencil, UserPlus, Target, Timer,
  Layers, AlertTriangle, Lock
} from 'lucide-react';

const ADMIN_SECRET = '4406';

function adminApiRequest(method: string, url: string, body?: any) {
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': ADMIN_SECRET,
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(res => {
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  });
}

interface StaffStats {
  id: number;
  name: string;
  dailyGoal: number;
  todayScans: number;
  todayHours: number;
  allTimeScans: number;
  allTimeHours: number;
  itemsPerHour: number;
  isClockIn: boolean;
}

interface BatchStats {
  id: number;
  name: string;
  totalItems: number;
  soldItems: number;
  sellThrough: number;
  roi: number;
}

interface AgingData {
  range: string;
  count: number;
}

interface CategoryPerformance {
  category: string;
  listed: number;
  sold: number;
  sellThrough: number;
}

interface FinancialSummary {
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  overallRoi: number;
  batchCount: number;
  totalItems: number;
  soldItems: number;
}

interface Staff {
  id: number;
  name: string;
  pinCode: string;
  dailyScanGoal: number;
  active: number;
  createdAt: string;
}

interface Batch {
  id: number;
  name: string;
  totalItems: number;
  soldItems: number;
  totalCost: number;
  totalRevenue: number;
  active: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffGoal, setNewStaffGoal] = useState('50');
  const [newBatchName, setNewBatchName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuthenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAdminLogin = () => {
    if (adminPasswordInput === ADMIN_SECRET) {
      setIsAuthenticated(true);
      localStorage.setItem('adminAuthenticated', 'true');
      toast({ title: 'Admin access granted' });
    } else {
      toast({ title: 'Invalid password', variant: 'destructive' });
    }
    setAdminPasswordInput('');
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuthenticated');
  };

  const { data: staffStats = [] } = useQuery<StaffStats[]>({
    queryKey: ['/api/analytics/staff'],
    queryFn: () => adminApiRequest('GET', '/api/analytics/staff'),
    enabled: isAuthenticated,
  });

  const { data: batchStats = [] } = useQuery<BatchStats[]>({
    queryKey: ['/api/analytics/batches'],
    queryFn: () => adminApiRequest('GET', '/api/analytics/batches'),
    enabled: isAuthenticated,
  });

  const { data: aging = [] } = useQuery<AgingData[]>({
    queryKey: ['/api/analytics/aging'],
    queryFn: () => adminApiRequest('GET', '/api/analytics/aging'),
    enabled: isAuthenticated,
  });

  const { data: categories = [] } = useQuery<CategoryPerformance[]>({
    queryKey: ['/api/analytics/categories'],
    queryFn: () => adminApiRequest('GET', '/api/analytics/categories'),
    enabled: isAuthenticated,
  });

  const { data: financial } = useQuery<FinancialSummary>({
    queryKey: ['/api/analytics/financial'],
    queryFn: () => adminApiRequest('GET', '/api/analytics/financial'),
    enabled: isAuthenticated,
  });

  const { data: allStaff = [] } = useQuery<Staff[]>({
    queryKey: ['/api/staff'],
    queryFn: () => adminApiRequest('GET', '/api/staff'),
    enabled: isAuthenticated,
  });

  const { data: allBatches = [] } = useQuery<Batch[]>({
    queryKey: ['/api/batches'],
    queryFn: () => adminApiRequest('GET', '/api/batches'),
    enabled: isAuthenticated,
  });

  const { data: activeBatch } = useQuery<Batch | null>({
    queryKey: ['/api/batches/active'],
    queryFn: () => adminApiRequest('GET', '/api/batches/active'),
    enabled: isAuthenticated,
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: { name: string; pinCode: string; dailyScanGoal: number }) => {
      return adminApiRequest('POST', '/api/staff', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/staff'] });
      setStaffDialogOpen(false);
      setNewStaffName('');
      setNewStaffPin('');
      setNewStaffGoal('50');
      toast({ title: 'Staff member created' });
    },
    onError: () => {
      toast({ title: 'Failed to create staff member', variant: 'destructive' });
    }
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Staff> }) => {
      return adminApiRequest('PATCH', `/api/staff/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/staff'] });
      setStaffDialogOpen(false);
      setEditingStaff(null);
      toast({ title: 'Staff member updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update staff member', variant: 'destructive' });
    }
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      return adminApiRequest('POST', '/api/batches', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/batches/active'] });
      setBatchDialogOpen(false);
      setNewBatchName('');
      toast({ title: 'New batch created and set as active' });
    },
    onError: () => {
      toast({ title: 'Failed to create batch', variant: 'destructive' });
    }
  });

  // Admin login gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter the admin password to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              className="text-center"
              data-testid="input-admin-password"
            />
            <Button className="w-full" onClick={handleAdminLogin} data-testid="button-admin-login">
              Login
            </Button>
            <Link href="/staff">
              <Button variant="ghost" className="w-full" data-testid="button-back-to-scanner">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Scanner
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateStaff = () => {
    if (!newStaffName || !newStaffPin || newStaffPin.length !== 4) {
      toast({ title: 'Please enter a name and 4-digit PIN', variant: 'destructive' });
      return;
    }
    createStaffMutation.mutate({
      name: newStaffName,
      pinCode: newStaffPin,
      dailyScanGoal: parseInt(newStaffGoal) || 50,
    });
  };

  const handleUpdateStaff = () => {
    if (!editingStaff) return;
    updateStaffMutation.mutate({
      id: editingStaff.id,
      data: {
        name: newStaffName,
        dailyScanGoal: parseInt(newStaffGoal) || 50,
      }
    });
  };

  const handleCreateBatch = () => {
    if (!newBatchName) {
      toast({ title: 'Please enter a batch name', variant: 'destructive' });
      return;
    }
    createBatchMutation.mutate({ name: newBatchName });
  };

  const openEditStaff = (staff: Staff) => {
    setEditingStaff(staff);
    setNewStaffName(staff.name);
    setNewStaffPin(staff.pinCode);
    setNewStaffGoal(staff.dailyScanGoal?.toString() || '50');
    setStaffDialogOpen(true);
  };

  const totalUnsold = aging.reduce((sum, a) => sum + a.count, 0);
  const slowMoving = aging.filter(a => a.range === '60-90 days' || a.range === '90+ days')
    .reduce((sum, a) => sum + a.count, 0);

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-admin-dashboard">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleAdminLogout} data-testid="button-admin-logout">
          <Lock className="w-4 h-4 mr-1" />
          Logout
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
          <TabsTrigger value="batches" data-testid="tab-batches">Batches</TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DollarSign className="h-4 w-4" />
                  Total Revenue
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-revenue">
                  ${financial?.totalRevenue?.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Total Profit
                </div>
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-profit">
                  ${financial?.totalProfit?.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Package className="h-4 w-4" />
                  Items Listed
                </div>
                <p className="text-2xl font-bold" data-testid="text-items-listed">
                  {financial?.totalItems || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <BarChart3 className="h-4 w-4" />
                  ROI
                </div>
                <p className="text-2xl font-bold" data-testid="text-roi">
                  {financial?.overallRoi || 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Staff Performance Today
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {staffStats.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No staff data available</p>
                ) : (
                  staffStats.map((s) => (
                    <div key={s.id} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{s.name}</span>
                        <div className="flex items-center gap-2">
                          {s.isClockIn && (
                            <Badge variant="outline" className="text-green-600">Clocked In</Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {s.todayScans} / {s.dailyGoal}
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={Math.min((s.todayScans / s.dailyGoal) * 100, 100)} 
                        className="h-2"
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Inventory Aging
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aging.map((a) => (
                    <div key={a.range} className="flex justify-between items-center">
                      <span className={a.range.includes('90') ? 'text-red-600 font-medium' : ''}>
                        {a.range}
                      </span>
                      <Badge variant={a.range.includes('90') ? 'destructive' : 'secondary'}>
                        {a.count} items
                      </Badge>
                    </div>
                  ))}
                  {slowMoving > 0 && (
                    <div className="flex items-center gap-2 mt-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span>{slowMoving} items sitting 60+ days</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Batch Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {batchStats.length === 0 ? (
                <p className="text-muted-foreground text-sm">No batches created yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Batch</th>
                        <th className="text-right py-2">Items</th>
                        <th className="text-right py-2">Sold</th>
                        <th className="text-right py-2">Sell-Through</th>
                        <th className="text-right py-2">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchStats.slice(0, 5).map((b) => (
                        <tr key={b.id} className="border-b">
                          <td className="py-2">{b.name}</td>
                          <td className="text-right">{b.totalItems}</td>
                          <td className="text-right">{b.soldItems}</td>
                          <td className="text-right">
                            <Badge variant={b.sellThrough >= 50 ? 'default' : 'secondary'}>
                              {b.sellThrough}%
                            </Badge>
                          </td>
                          <td className="text-right">
                            <span className={b.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {b.roi}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Staff Management</h2>
            <Button 
              onClick={() => {
                setEditingStaff(null);
                setNewStaffName('');
                setNewStaffPin('');
                setNewStaffGoal('50');
                setStaffDialogOpen(true);
              }}
              data-testid="button-add-staff"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </div>

          <div className="grid gap-4">
            {allStaff.map((s) => {
              const stats = staffStats.find(st => st.id === s.id);
              return (
                <Card key={s.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{s.name}</h3>
                          {s.active === 0 && <Badge variant="secondary">Inactive</Badge>}
                          {stats?.isClockIn && <Badge variant="outline" className="text-green-600">Clocked In</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">PIN: {s.pinCode}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openEditStaff(s)}
                        data-testid={`button-edit-staff-${s.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    {stats && (
                      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{stats.todayScans}</p>
                          <p className="text-xs text-muted-foreground">Today</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stats.allTimeScans}</p>
                          <p className="text-xs text-muted-foreground">All Time</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stats.itemsPerHour}</p>
                          <p className="text-xs text-muted-foreground">Items/Hr</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Daily Goal</span>
                        <span>{stats?.todayScans || 0} / {s.dailyScanGoal}</span>
                      </div>
                      <Progress 
                        value={Math.min(((stats?.todayScans || 0) / (s.dailyScanGoal || 50)) * 100, 100)} 
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Batch Management</h2>
              {activeBatch && (
                <p className="text-sm text-muted-foreground">
                  Active batch: <span className="font-medium">{activeBatch.name}</span>
                </p>
              )}
            </div>
            <Button onClick={() => setBatchDialogOpen(true)} data-testid="button-create-batch">
              <Plus className="h-4 w-4 mr-2" />
              New Batch
            </Button>
          </div>

          <div className="grid gap-4">
            {allBatches.map((b) => {
              const stats = batchStats.find(bs => bs.id === b.id);
              return (
                <Card key={b.id} className={b.active === 1 ? 'border-primary' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{b.name}</h3>
                          {b.active === 1 && <Badge>Active</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Created: {new Date(b.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xl font-bold">{b.totalItems}</p>
                        <p className="text-xs text-muted-foreground">Items</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{b.soldItems}</p>
                        <p className="text-xs text-muted-foreground">Sold</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{stats?.sellThrough || 0}%</p>
                        <p className="text-xs text-muted-foreground">Sell-Through</p>
                      </div>
                      <div>
                        <p className={`text-xl font-bold ${(stats?.roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats?.roi || 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">ROI</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between text-sm">
                      <span>Cost: ${(b.totalCost / 100).toFixed(2)}</span>
                      <span>Revenue: ${(b.totalRevenue / 100).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
              <CardDescription>Sell-through rate by category</CardDescription>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-muted-foreground text-sm">No category data available</p>
              ) : (
                <div className="space-y-3">
                  {categories
                    .filter(c => c.listed > 0)
                    .sort((a, b) => b.sellThrough - a.sellThrough)
                    .map((c) => (
                      <div key={c.category} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{c.category}</span>
                          <span className="text-sm text-muted-foreground">
                            {c.sold} / {c.listed} ({c.sellThrough}%)
                          </span>
                        </div>
                        <Progress value={c.sellThrough} className="h-2" />
                      </div>
                    ))
                  }
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Slow Moving Inventory
              </CardTitle>
              <CardDescription>Items that have been listed for 60+ days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {aging.map((a) => (
                  <div 
                    key={a.range} 
                    className={`p-4 rounded-lg ${
                      a.range.includes('90') ? 'bg-red-50 dark:bg-red-900/20' :
                      a.range.includes('60') ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                      'bg-muted'
                    }`}
                  >
                    <p className="text-2xl font-bold">{a.count}</p>
                    <p className="text-sm text-muted-foreground">{a.range}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staffName">Name</Label>
              <Input 
                id="staffName"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Employee name"
                data-testid="input-staff-name"
              />
            </div>
            {!editingStaff && (
              <div className="space-y-2">
                <Label htmlFor="staffPin">PIN (4 digits)</Label>
                <Input 
                  id="staffPin"
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                  data-testid="input-staff-pin"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="staffGoal">Daily Scan Goal</Label>
              <Input 
                id="staffGoal"
                type="number"
                value={newStaffGoal}
                onChange={(e) => setNewStaffGoal(e.target.value)}
                placeholder="50"
                data-testid="input-staff-goal"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={editingStaff ? handleUpdateStaff : handleCreateStaff}
              disabled={createStaffMutation.isPending || updateStaffMutation.isPending}
              data-testid="button-save-staff"
            >
              {editingStaff ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batchName">Batch Name</Label>
              <Input 
                id="batchName"
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                placeholder={`Batch ${new Date().toLocaleDateString()}`}
                data-testid="input-batch-name"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Creating a new batch will set it as the active batch. All new scans will be assigned to this batch.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateBatch}
              disabled={createBatchMutation.isPending}
              data-testid="button-save-batch"
            >
              Create Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
