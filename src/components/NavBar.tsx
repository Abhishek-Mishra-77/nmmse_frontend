'use client'
import React from 'react'
import Image from 'next/image';
import { useRouter } from 'next/navigation'

const NavBar = () => {
    const router = useRouter();

    return (
        <nav className="bg-white border-gray-200 dark:bg-gray-900">
            <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
                <span className="flex items-center space-x-3 rtl:space-x-reverse">
                    <Image
                        src="/ios.png"
                        alt="Flowbite Logo"
                        width={48}
                        height={48}
                    />
                    <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">NMMSE</span>
                </span>

                <div className="hidden w-full md:block md:w-auto" id="navbar-default">
                    <ul className="font-medium flex flex-col p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 md:bg-white dark:bg-gray-800 md:dark:bg-gray-900 dark:border-gray-700">
                        <li>
                            <span onClick={() => router.push("/dashboard")} className="block py-2 px-3 text-white bg-blue-700 rounded-sm md:bg-transparent cursor-pointer md:text-blue-700 md:p-0 dark:text-white md:dark:text-blue-500" aria-current="page">DASHBOARD</span>
                        </li>
                        <li>
                            <span onClick={() => router.push("/dashboard/signup")} className="block py-2 px-3 text-gray-900 cursor-pointer rounded-sm hover:bg-gray-100 md:hover:bg-transparent md:border-0 md:hover:text-blue-700 md:p-0 dark:text-white md:dark:hover:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent">ACCOUNT</span>
                        </li>

                    </ul>
                </div>
            </div>
        </nav>
    )
}

export default NavBar
