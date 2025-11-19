import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateFilterSelector } from "@/components/DateFilterSelector";
import ThemeToggle from "@/components/ui/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Header with breadcrumbs and actions */}
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <AppBreadcrumb />
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto px-4">
              <DateFilterSelector />
              <ThemeToggle />
              <Button onClick={() => navigate("/vendas")} variant="default" size="sm" className="hidden sm:flex">
                <ShoppingCart className="h-3 w-3 mr-1" /> 
                <span className="text-xs">Nova Venda</span>
              </Button>
            </div>
          </header>
          
          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-4 pt-0">
            <div className="animate-slide-up space-y-4">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
export default Layout;