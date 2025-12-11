import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, LogOut, User, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NLPConsole } from '@/components/NLPConsole';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, employee, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-3">
          <Package className="w-8 h-8 text-primary" />
          <span className="text-lg font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Inventory Manager</h1>
              <p className="text-xs text-muted-foreground">NLP Command Console</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{employee?.e_name || user.email}</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium capitalize">
                {userRole?.replace('_', ' ') || 'User'}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 flex flex-col">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Terminal className="w-4 h-4" />
          <span>Type natural language commands to manage your inventory</span>
        </div>
        
        <div className="flex-1 min-h-[500px] rounded-xl overflow-hidden shadow-2xl glow-primary">
          <NLPConsole />
        </div>
      </main>
    </div>
  );
}
