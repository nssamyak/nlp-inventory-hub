import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Mail, Lock, User, Loader2, Briefcase, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const designations = [
  { value: 'warehouse_staff', label: 'Warehouse Staff', description: 'Manage stock movements and inventory' },
  { value: 'procurement_officer', label: 'Procurement Officer', description: 'Handle orders, suppliers, and bills' },
  { value: 'manager', label: 'Manager', description: 'Oversee operations and approve transactions' },
  { value: 'admin', label: 'Administrator', description: 'Full system access and user management' },
];

const departments = [
  { value: 'warehouse', label: 'Warehouse Operations' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'management', label: 'Management' },
  { value: 'admin', label: 'Administration' },
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/');
      } else {
        if (!designation) {
          toast({ title: 'Error', description: 'Please select your designation', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, firstName, lastName, designation, department);
        if (error) throw error;
        toast({ title: 'Success', description: 'Account created! You can now sign in.' });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Authentication failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Inventory Manager</h1>
          <p className="text-muted-foreground mt-1">NLP-Powered Inventory System</p>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <div className="flex mb-6 bg-muted rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin ? 'bg-card shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin ? 'bg-card shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-9"
                      required={!isLogin}
                    />
                  </div>
                  <Input
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={!isLogin}
                  />
                </div>

                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Select value={designation} onValueChange={setDesignation} required>
                    <SelectTrigger className="pl-9">
                      <SelectValue placeholder="Select your designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designations.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          <div>
                            <div className="font-medium">{d.label}</div>
                            <div className="text-xs text-muted-foreground">{d.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="pl-9">
                      <SelectValue placeholder="Select department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Access Levels:</p>
                  <ul className="space-y-1">
                    <li>• <strong>Warehouse Staff:</strong> Stock movements, view inventory</li>
                    <li>• <strong>Procurement:</strong> Orders, suppliers, bills</li>
                    <li>• <strong>Manager:</strong> Approvals, reports, all operations</li>
                    <li>• <strong>Admin:</strong> Full access including user management</li>
                  </ul>
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
