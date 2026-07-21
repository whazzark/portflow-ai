import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { StatusIndicator } from '@/components/ui/status-indicator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const rotations = [
  { id: 'ROT-000184', truck: 'BF-472-ND', status: 'At weighbridge', tonnage: '28.450 t' },
  { id: 'ROT-000183', truck: 'DT-891-KR', status: 'In transit', tonnage: '27.980 t' },
  { id: 'ROT-000182', truck: 'GA-216-PL', status: 'Completed', tonnage: '29.120 t' },
]

export function OperationsOverview() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 lg:p-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Overview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading font-semibold text-3xl tracking-tight">
            Operations overview
          </h1>
          <Badge variant="secondary">Demo data</Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          A representative shell preview. Operational data will arrive with its dedicated
          workbenches.
        </p>
      </div>

      <Alert>
        <AlertTitle>Shift handoff at 14:00</AlertTitle>
        <AlertDescription>
          Confirm the active truck positions before the next shift lead takes over.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rotation progress</CardTitle>
            <CardDescription>Current discharge: MV Northern Passage</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Progress value={62}>
              <ProgressLabel>62% of expected tonnage</ProgressLabel>
              <ProgressValue />
            </Progress>
            <div className="flex flex-wrap gap-4">
              <StatusIndicator label="1 rotation at weighbridge" variant="warning" />
              <StatusIndicator label="2 trucks in motion" variant="success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shift status</CardTitle>
            <CardDescription>Morning shift · 06:00–14:00</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatusIndicator label="In progress" variant="success" />
            <p className="text-muted-foreground text-sm">Responsible: Marie Laurent</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rotations">
        <TabsList aria-label="Operations overview sections">
          <TabsTrigger value="rotations">Rotations</TabsTrigger>
          <TabsTrigger value="attention">Attention</TabsTrigger>
        </TabsList>
        <TabsContent value="rotations">
          <Card>
            <CardHeader>
              <CardTitle>Latest rotation activity</CardTitle>
              <CardDescription>
                Placeholder records shown only to demonstrate the application frame.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table aria-label="Recent rotations">
                <TableHeader>
                  <TableRow>
                    <TableHead>Rotation</TableHead>
                    <TableHead>Truck</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tonnage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rotations.map((rotation) => (
                    <TableRow key={rotation.id}>
                      <TableCell className="font-mono text-xs">{rotation.id}</TableCell>
                      <TableCell>{rotation.truck}</TableCell>
                      <TableCell>{rotation.status}</TableCell>
                      <TableCell className="tabular-nums">{rotation.tonnage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="attention">
          <Card>
            <CardHeader>
              <CardTitle>No operational attention items</CardTitle>
              <CardDescription>This placeholder tab has no business behavior.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
