import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login({ voauthUrl }: { voauthUrl: string }) {
    return (
        <div className='min-h-screen flex items-center justify-center'>
            <Card className='w-11/12 md:w-full max-w-md gap-3'>
                <CardHeader className='text-center flex flex-col items-center'>
                    <CardTitle className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-md'>ping</CardTitle>
                    <CardDescription className='text-base'>
                        ping is a status page service.<br />
                        view the source on <a className='underline' target='_blank' href='https://github.com/VillainsRule/ping'>github</a>
                    </CardDescription>
                </CardHeader>

                <CardContent className='space-y-4'>
                    <Button variant='outline' size='sm' className='text-sm w-full cursor-pointer' onClick={() => location.href = voauthUrl}>sign in</Button>
                </CardContent>
            </Card>
        </div>
    )
};