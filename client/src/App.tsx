import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Browse from "@/pages/Browse";
import AuctionDetail from "@/pages/AuctionDetail";
import Search from "@/pages/Search";
import Profile from "@/pages/Profile";
import Staff from "@/pages/Staff";
import Inventory from "@/pages/Inventory";
import RetailValueFinder from "@/pages/RetailValueFinder";
import LiveView from "@/pages/LiveView";
import Clothes from "@/pages/Clothes";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Browse} />
      <Route path="/auction/:id" component={AuctionDetail} />
      <Route path="/search" component={Search} />
      <Route path="/profile" component={Profile} />
      <Route path="/staff" component={Staff} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/value-finder" component={RetailValueFinder} />
      <Route path="/live" component={LiveView} />
      <Route path="/clothes" component={Clothes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
