import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Key, History, Building2, Package, Tag, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useWarehouses, useSuppliers, useCategories } from '@/hooks/useInventoryData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Employee {
  e_id: string;
  e_name: string;
  f_name: string;
  l_name: string;
  user_id: string;
  department: { d_name: string } | null;
  role: { role_name: string } | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

interface CommandHistory {
  id: string;
  command: string;
  success: boolean;
  created_at: string;
  user_id: string;
}

interface Department {
  d_id: number;
  d_name: string;
}

interface Role {
  role_id: number;
  role_name: string;
}

export default function Admin() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { warehouses, refetch: refetchWarehouses } = useWarehouses();
  const { suppliers, refetch: refetchSuppliers } = useSuppliers();
  const { categories, refetch: refetchCategories } = useCategories();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Form states
  const [newWarehouse, setNewWarehouse] = useState({ w_name: '', address: '' });
  const [newDepartment, setNewDepartment] = useState('');
  const [newCategory, setNewCategory] = useState({ cat_name: '', parent_id: '' });
  const [newSupplier, setNewSupplier] = useState({ s_name: '', address: '', contact_email: '', contact_phone: '' });
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchEmployees();
      fetchUserRoles();
      fetchCommandHistory();
      fetchDepartments();
      fetchRoles();
    }
  }, [user]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*, department:departments(*), role:roles(*)');
    if (data) setEmployees(data as Employee[]);
  };

  const fetchUserRoles = async () => {
    const { data } = await supabase.from('user_roles').select('*');
    if (data) setUserRoles(data);
  };

  const fetchCommandHistory = async () => {
    const { data } = await supabase
      .from('command_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setCommandHistory(data);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*');
    if (data) setDepartments(data);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*');
    if (data) setRoles(data);
  };

  const addWarehouse = async () => {
    if (!newWarehouse.w_name) return toast.error('Warehouse name is required');
    const { error } = await supabase.from('warehouses').insert(newWarehouse);
    if (error) return toast.error(error.message);
    toast.success('Warehouse added');
    setNewWarehouse({ w_name: '', address: '' });
    refetchWarehouses();
  };

  const addDepartment = async () => {
    if (!newDepartment) return toast.error('Department name is required');
    const { error } = await supabase.from('departments').insert({ d_name: newDepartment });
    if (error) return toast.error(error.message);
    toast.success('Department added');
    setNewDepartment('');
    fetchDepartments();
  };

  const addCategory = async () => {
    if (!newCategory.cat_name) return toast.error('Category name is required');
    const { error } = await supabase.from('categories').insert({
      cat_name: newCategory.cat_name,
      parent_id: newCategory.parent_id ? parseInt(newCategory.parent_id) : null,
    });
    if (error) return toast.error(error.message);
    toast.success('Category added');
    setNewCategory({ cat_name: '', parent_id: '' });
    refetchCategories();
  };

  const addSupplier = async () => {
    if (!newSupplier.s_name) return toast.error('Supplier name is required');
    const { error } = await supabase.from('suppliers').insert(newSupplier);
    if (error) return toast.error(error.message);
    toast.success('Supplier added');
    setNewSupplier({ s_name: '', address: '', contact_email: '', contact_phone: '' });
    refetchSuppliers();
  };

  const updateUserRole = async () => {
    if (!selectedEmployee || !selectedRole) return toast.error('Select employee and role');
    
    const employee = employees.find(e => e.e_id === selectedEmployee);
    if (!employee) return;

    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', employee.user_id);
    
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: employee.user_id, role: selectedRole as 'admin' | 'manager' | 'warehouse_staff' | 'procurement_officer' });
    
    if (error) return toast.error(error.message);
    toast.success('Role updated');
    fetchUserRoles();
    setSelectedEmployee('');
    setSelectedRole('');
  };

  const deleteWarehouse = async (id: number) => {
    const { error } = await supabase.from('warehouses').delete().eq('w_id', id);
    if (error) return toast.error(error.message);
    toast.success('Warehouse deleted');
    refetchWarehouses();
  };

  const deleteSupplier = async (id: number) => {
    const { error } = await supabase.from('suppliers').delete().eq('sup_id', id);
    if (error) return toast.error(error.message);
    toast.success('Supplier deleted');
    refetchSuppliers();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">Admin Panel</h1>
                <p className="text-xs text-muted-foreground">System Management</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/">Console</NavLink>
              <NavLink to="/data">Data View</NavLink>
              <NavLink to="/admin">Admin</NavLink>
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto p-4">
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Members</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="manage" className="gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Manage</span>
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.e_id}>
                        <TableCell>{emp.f_name} {emp.l_name}</TableCell>
                        <TableCell>{emp.e_name}</TableCell>
                        <TableCell>{emp.department?.d_name || '-'}</TableCell>
                        <TableCell>{emp.role?.role_name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>User Roles</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>App Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRoles.map((ur) => (
                        <TableRow key={ur.id}>
                          <TableCell className="font-mono text-xs">{ur.user_id.slice(0, 8)}...</TableCell>
                          <TableCell className="capitalize">{ur.role.replace('_', ' ')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assign Role</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.e_id} value={emp.e_id}>
                            {emp.f_name} {emp.l_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>App Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                        <SelectItem value="procurement_officer">Procurement Officer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={updateUserRole} className="w-full">
                    Update Role
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Command History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Command</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commandHistory.map((cmd) => (
                        <TableRow key={cmd.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(cmd.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-sm max-w-md truncate">
                            {cmd.command}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              cmd.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {cmd.success ? 'Success' : 'Failed'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Warehouses */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Warehouses
                  </CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Warehouse</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={newWarehouse.w_name}
                            onChange={(e) => setNewWarehouse({ ...newWarehouse, w_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Address</Label>
                          <Input
                            value={newWarehouse.address}
                            onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                          />
                        </div>
                        <Button onClick={addWarehouse} className="w-full">Add Warehouse</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {warehouses?.map((w) => (
                      <div key={w.w_id} className="flex items-center justify-between p-2 rounded bg-muted">
                        <div>
                          <p className="font-medium">{w.w_name}</p>
                          <p className="text-xs text-muted-foreground">{w.address || 'No address'}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteWarehouse(w.w_id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Suppliers */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Suppliers
                  </CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Supplier</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={newSupplier.s_name}
                            onChange={(e) => setNewSupplier({ ...newSupplier, s_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newSupplier.contact_email}
                            onChange={(e) => setNewSupplier({ ...newSupplier, contact_email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={newSupplier.contact_phone}
                            onChange={(e) => setNewSupplier({ ...newSupplier, contact_phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Address</Label>
                          <Input
                            value={newSupplier.address}
                            onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                          />
                        </div>
                        <Button onClick={addSupplier} className="w-full">Add Supplier</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {suppliers?.map((s) => (
                      <div key={s.sup_id} className="flex items-center justify-between p-2 rounded bg-muted">
                        <div>
                          <p className="font-medium">{s.s_name}</p>
                          <p className="text-xs text-muted-foreground">{s.contact_email || 'No email'}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteSupplier(s.sup_id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Departments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Departments
                  </CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Department</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={newDepartment}
                            onChange={(e) => setNewDepartment(e.target.value)}
                          />
                        </div>
                        <Button onClick={addDepartment} className="w-full">Add Department</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {departments.map((d) => (
                      <div key={d.d_id} className="p-2 rounded bg-muted">
                        <p className="font-medium">{d.d_name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Categories */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Categories
                  </CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Category</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={newCategory.cat_name}
                            onChange={(e) => setNewCategory({ ...newCategory, cat_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Parent Category (optional)</Label>
                          <Select
                            value={newCategory.parent_id}
                            onValueChange={(v) => setNewCategory({ ...newCategory, parent_id: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {categories?.map((c) => (
                                <SelectItem key={c.c_id} value={c.c_id.toString()}>
                                  {c.cat_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={addCategory} className="w-full">Add Category</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {categories?.map((c) => (
                      <div key={c.c_id} className="p-2 rounded bg-muted">
                        <p className="font-medium">{c.cat_name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
